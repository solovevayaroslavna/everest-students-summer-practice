// everest
// Copyright (C) 2023 Percona LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package api

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/AlekSi/pointer"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	goversion "github.com/hashicorp/go-version"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"golang.org/x/mod/semver"
	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	everestv1alpha1 "github.com/percona/everest-operator/api/v1alpha1"
	"github.com/percona/everest/cmd/config"
	"github.com/percona/everest/pkg/common"
	"github.com/percona/everest/pkg/kubernetes"
	"github.com/percona/everest/pkg/rbac"
)

const (
	pxcDeploymentName   = "percona-xtradb-cluster-operator"
	psmdbDeploymentName = "percona-server-mongodb-operator"
	pgDeploymentName    = "percona-postgresql-operator"
	dateFormat          = "2006-01-02T15:04:05Z"
	pgReposLimit        = 3
	// We are diverging from the RFC1035 spec in regards to the length of the
	// name because the PXC operator limits the name of the cluster to 22.
	maxNameLength       = 22
	timeoutS3AccessSec  = 2
	minShardsNum        = 1
	minConfigServersNum = 1
)

var (
	minStorageQuantity = resource.MustParse("1G")   //nolint:gochecknoglobals
	minCPUQuantity     = resource.MustParse("600m") //nolint:gochecknoglobals
	minMemQuantity     = resource.MustParse("512M") //nolint:gochecknoglobals

	errDBCEmptyMetadata              = errors.New("databaseCluster's Metadata should not be empty")
	errDBCNameEmpty                  = errors.New("databaseCluster's metadata.name should not be empty")
	errDBCNamespaceEmpty             = errors.New("databaseCluster's metadata.namespace should not be empty")
	errDBCNameWrongFormat            = errors.New("databaseCluster's metadata.name should be a string")
	errDBCNamespaceWrongFormat       = errors.New("databaseCluster's metadata.namespace should be a string")
	errNotEnoughMemory               = fmt.Errorf("memory limits should be above %s", minMemQuantity.String())
	errInt64NotSupported             = errors.New("specifying resources using int64 data type is not supported. Please use string format for that")
	errNotEnoughCPU                  = fmt.Errorf("CPU limits should be above %s", minCPUQuantity.String())
	errNotEnoughDiskSize             = fmt.Errorf("storage size should be above %s", minStorageQuantity.String())
	errUnsupportedPXCProxy           = errors.New("you can use either HAProxy or Proxy SQL for PXC clusters")
	errUnsupportedPGProxy            = errors.New("you can use only PGBouncer as a proxy type for Postgres clusters")
	errUnsupportedPSMDBProxy         = errors.New("you can use only Mongos as a proxy type for MongoDB clusters")
	errNoSchedules                   = errors.New("please specify at least one backup schedule")
	errNoNameInSchedule              = errors.New("'name' field for the backup schedules cannot be empty")
	errScheduleNoBackupStorageName   = errors.New("'backupStorageName' field cannot be empty when schedule is enabled")
	errPitrNoBackupStorageName       = errors.New("'backupStorageName' field cannot be empty when pitr is enabled")
	errNoResourceDefined             = errors.New("please specify resource limits for the cluster")
	errPitrUploadInterval            = errors.New("'uploadIntervalSec' should be more than 0")
	errPXCPitrS3Only                 = errors.New("point-in-time recovery only supported for s3 compatible storages")
	errPSMDBMultipleStorages         = errors.New("can't use more than one backup storage for PSMDB clusters")
	errPSMDBViolateActiveStorage     = errors.New("can't change the active storage for PSMDB clusters")
	errDataSourceConfig              = errors.New("either DBClusterBackupName or BackupSource must be specified in the DataSource field")
	errDataSourceNoPitrDateSpecified = errors.New("pitr Date must be specified for type Date")
	errDataSourceWrongDateFormat     = errors.New("failed to parse .Spec.DataSource.Pitr.Date as 2006-01-02T15:04:05Z")
	errDataSourceNoBackupStorageName = errors.New("'backupStorageName' should be specified in .Spec.DataSource.BackupSource")
	errDataSourceNoPath              = errors.New("'path' should be specified in .Spec.DataSource.BackupSource")
	errIncorrectDataSourceStruct     = errors.New("incorrect data source struct")
	errUnsupportedPitrType           = errors.New("the given point-in-time recovery type is not supported")
	errTooManyPGStorages             = fmt.Errorf("only %d different storages are allowed in a PostgreSQL cluster", pgReposLimit)
	errNoMetadata                    = fmt.Errorf("no metadata provided")
	errInvalidResourceVersion        = fmt.Errorf("invalid 'resourceVersion' value")
	errInvalidBucketName             = fmt.Errorf("invalid bucketName")
	errInvalidVersion                = errors.New("invalid database engine version provided")
	errDBEngineMajorVersionUpgrade   = errors.New("database engine cannot be upgraded to a major version")
	errDBEngineDowngrade             = errors.New("database engine version cannot be downgraded")
	errDuplicatedSchedules           = errors.New("duplicated backup schedules are not allowed")
	errDuplicatedStoragePG           = errors.New("postgres clusters can't use the same storage for the different schedules")
	errStorageChangePG               = errors.New("the existing postgres schedules can't change their storage")
	errDuplicatedBackupStorage       = errors.New("backup storages with the same url, bucket and url are not allowed")
	errEditBackupStorageInUse        = errors.New("can't edit bucket or region of the backup storage in use")
	errInsufficientPermissions       = errors.New("insufficient permissions for performing the operation")
	errShardingIsNotSupported        = errors.New("sharding is not supported")
	errInsufficientShardsNumber      = errors.New("shards number should be greater than 0")
	errInsufficientCfgSrvNumber      = errors.New("sharding: minimum config servers number is 1")
	errEvenServersNumber             = errors.New("sharding: config servers number should be odd")
	errDisableShardingNotSupported   = errors.New("sharding: disable sharding is not supported")
	errShardingEnablingNotSupported  = errors.New("sharding: enable sharding is not supported when editing db cluster")
	errChangeShardsNumNotSupported   = errors.New("sharding: change shards number is not supported")
	errChangeCfgSrvNotSupported      = errors.New("sharding: change config server number is not supported")
	errShardingVersion               = errors.New("sharding is available starting PSMDB 1.17.0")

	//nolint:gochecknoglobals
	operatorEngine = map[everestv1alpha1.EngineType]string{
		everestv1alpha1.DatabaseEnginePXC:        pxcDeploymentName,
		everestv1alpha1.DatabaseEnginePSMDB:      psmdbDeploymentName,
		everestv1alpha1.DatabaseEnginePostgresql: pgDeploymentName,
	}
)

// ErrNameNotRFC1035Compatible when the given fieldName doesn't contain RFC 1035 compatible string.
func ErrNameNotRFC1035Compatible(fieldName string) error {
	return fmt.Errorf(`'%s' is not RFC 1035 compatible. The name should contain only lowercase alphanumeric characters or '-', start with an alphabetic character, end with an alphanumeric character`,
		fieldName,
	)
}

// ErrNameTooLong when the given fieldName is longer than expected.
func ErrNameTooLong(fieldName string) error {
	return fmt.Errorf("'%s' can be at most 22 characters long", fieldName)
}

// ErrCreateStorageNotSupported appears when trying to create a storage of a type that is not supported.
func ErrCreateStorageNotSupported(storageType string) error {
	return fmt.Errorf("creating storage is not implemented for '%s'", storageType)
}

// ErrUpdateStorageNotSupported appears when trying to update a storage of a type that is not supported.
func ErrUpdateStorageNotSupported(storageType string) error {
	return fmt.Errorf("updating storage is not implemented for '%s'", storageType)
}

// ErrInvalidURL when the given fieldName contains invalid URL.
func ErrInvalidURL(fieldName string) error {
	return fmt.Errorf("'%s' is an invalid URL", fieldName)
}

// validates names to be RFC-1035 compatible  https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#rfc-1035-label-names
func validateRFC1035(s, name string) error {
	if len(s) > maxNameLength {
		return ErrNameTooLong(name)
	}

	rfc1035Regex := "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
	re := regexp.MustCompile(rfc1035Regex)
	if !re.MatchString(s) {
		return ErrNameNotRFC1035Compatible(name)
	}

	return nil
}

func validateURL(urlStr string) bool {
	_, err := url.ParseRequestURI(urlStr)
	return err == nil
}

func validateStorageAccessByCreate(ctx context.Context, params CreateBackupStorageParams, l *zap.SugaredLogger) error {
	switch params.Type {
	case CreateBackupStorageParamsTypeS3:
		return s3Access(l, params.Url, params.AccessKey, params.SecretKey, params.BucketName, params.Region, pointer.Get(params.VerifyTLS), pointer.Get(params.ForcePathStyle))
	case CreateBackupStorageParamsTypeAzure:
		return azureAccess(ctx, l, params.AccessKey, params.SecretKey, params.BucketName)
	default:
		return ErrCreateStorageNotSupported(string(params.Type))
	}
}

//nolint:funlen
func s3Access(
	l *zap.SugaredLogger,
	endpoint *string,
	accessKey, secretKey, bucketName, region string,
	verifyTLS bool,
	forcePathStyle bool,
) error {
	if config.Debug {
		return nil
	}

	if endpoint != nil && *endpoint == "" {
		endpoint = nil
	}

	c := http.DefaultClient
	c.Timeout = timeoutS3AccessSec * time.Second
	c.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: !verifyTLS}, //nolint:gosec
	}
	// Create a new session with the provided credentials
	sess, err := session.NewSession(&aws.Config{
		Endpoint:         endpoint,
		Region:           aws.String(region),
		Credentials:      credentials.NewStaticCredentials(accessKey, secretKey, ""),
		HTTPClient:       c,
		S3ForcePathStyle: aws.Bool(forcePathStyle),
	})
	if err != nil {
		l.Error(err)
		return errors.New("could not initialize S3 session")
	}

	// Create a new S3 client with the session
	svc := s3.New(sess)

	_, err = svc.HeadBucket(&s3.HeadBucketInput{
		Bucket: aws.String(bucketName),
	})
	if err != nil {
		l.Error(err)
		return errors.New("unable to connect to s3. Check your credentials")
	}

	testKey := "everest-write-test"
	_, err = svc.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(bucketName),
		Body:   bytes.NewReader([]byte{}),
		Key:    aws.String(testKey),
	})
	if err != nil {
		l.Error(err)
		return errors.New("could not write to S3 bucket")
	}

	_, err = svc.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(testKey),
	})
	if err != nil {
		l.Error(err)
		return errors.New("could not read from S3 bucket")
	}

	_, err = svc.ListObjectsV2(&s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
	})
	if err != nil {
		return errors.New("could not list objects in S3 bucket")
	}

	_, err = svc.DeleteObject(&s3.DeleteObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(testKey),
	})
	if err != nil {
		l.Error(err)
		return errors.New("could not delete an object from S3 bucket")
	}

	return nil
}

func azureAccess(ctx context.Context, l *zap.SugaredLogger, accountName, accountKey, containerName string) error {
	if config.Debug {
		return nil
	}

	cred, err := azblob.NewSharedKeyCredential(accountName, accountKey)
	if err != nil {
		l.Error(err)
		return errors.New("could not initialize Azure credentials")
	}

	client, err := azblob.NewClientWithSharedKeyCredential(fmt.Sprintf("https://%s.blob.core.windows.net/", url.PathEscape(accountName)), cred, nil)
	if err != nil {
		l.Error(err)
		return errors.New("could not initialize Azure client")
	}

	pager := client.NewListBlobsFlatPager(containerName, nil)
	if pager.More() {
		if _, err := pager.NextPage(ctx); err != nil {
			l.Error(err)
			return errors.New("could not list blobs in Azure container")
		}
	}

	blobName := "everest-test-blob"
	if _, err = client.UploadBuffer(ctx, containerName, blobName, []byte{}, nil); err != nil {
		l.Error(err)
		return errors.New("could not write to Azure container")
	}

	if _, err = client.DownloadBuffer(ctx, containerName, blobName, []byte{}, nil); err != nil {
		l.Error(err)
		return errors.New("could not read from Azure container")
	}

	if _, err = client.DeleteBlob(ctx, containerName, blobName, nil); err != nil {
		l.Error(err)
		return errors.New("could not delete a blob from Azure container")
	}

	return nil
}

func validateBackupStorageAccess(
	ctx echo.Context,
	sType string,
	url *string,
	bucketName, region, accessKey, secretKey string,
	verifyTLS bool,
	forcePathStyle bool,
	l *zap.SugaredLogger,
) error {
	switch sType {
	case string(BackupStorageTypeS3):
		if region == "" {
			return errors.New("region is required when using S3 storage type")
		}
		if err := s3Access(l, url, accessKey, secretKey, bucketName, region, verifyTLS, forcePathStyle); err != nil {
			return err
		}
	case string(BackupStorageTypeAzure):
		if err := azureAccess(ctx.Request().Context(), l, accessKey, secretKey, bucketName); err != nil {
			return err
		}
	default:
		return ErrUpdateStorageNotSupported(sType)
	}

	return nil
}

//nolint:funlen,cyclop
func (e *EverestServer) validateUpdateBackupStorageRequest(
	ctx echo.Context,
	bs *everestv1alpha1.BackupStorage,
	secret *corev1.Secret,
	l *zap.SugaredLogger,
) (*UpdateBackupStorageParams, error) {
	var params UpdateBackupStorageParams
	if err := ctx.Bind(&params); err != nil {
		return nil, err
	}

	c := ctx.Request().Context()
	used, err := e.kubeClient.IsBackupStorageUsed(c, bs.GetNamespace(), bs.GetName())
	if err != nil {
		return nil, err
	}
	if used && basicStorageParamsAreChanged(bs, params) {
		return nil, errEditBackupStorageInUse
	}

	existingStorages, err := e.kubeClient.ListBackupStorages(c, e.kubeClient.Namespace())
	if err != nil {
		return nil, err
	}
	if duplicate := validateDuplicateStorageByUpdate(bs.GetName(), bs, existingStorages, params); duplicate {
		return nil, errDuplicatedBackupStorage
	}

	url := &bs.Spec.EndpointURL
	if params.Url != nil {
		if ok := validateURL(*params.Url); !ok {
			err := ErrInvalidURL("url")
			return nil, err
		}
		url = params.Url
	}

	if params.BucketName != nil {
		if err := validateBucketName(*params.BucketName); err != nil {
			return nil, err
		}
	}

	accessKey := string(secret.Data["AWS_ACCESS_KEY_ID"])
	if params.AccessKey != nil {
		accessKey = *params.AccessKey
	}
	secretKey := string(secret.Data["AWS_SECRET_ACCESS_KEY"])
	if params.SecretKey != nil {
		secretKey = *params.SecretKey
	}

	bucketName := bs.Spec.Bucket
	if params.BucketName != nil {
		bucketName = *params.BucketName
	}

	region := bs.Spec.Region
	if params.Region != nil {
		region = *params.Region
	}

	err = validateBackupStorageAccess(ctx, string(bs.Spec.Type), url, bucketName, region, accessKey, secretKey, pointer.Get(params.VerifyTLS), pointer.Get(params.ForcePathStyle), l)
	if err != nil {
		return nil, err
	}

	return &params, nil
}

func (params *UpdateBackupStorageParams) regionOrDefault(defaultRegion string) string {
	if params.Region != nil {
		return *params.Region
	}
	return defaultRegion
}

func (params *UpdateBackupStorageParams) bucketNameOrDefault(defaultBucketName string) string {
	if params.BucketName != nil {
		return *params.BucketName
	}
	return defaultBucketName
}

func (params *UpdateBackupStorageParams) urlOrDefault(defaultURL string) string {
	if params.Url != nil {
		return *params.Url
	}
	return defaultURL
}

func validateDuplicateStorageByUpdate(
	currentStorageName string,
	currentStorage *everestv1alpha1.BackupStorage,
	existingStorages *everestv1alpha1.BackupStorageList,
	params UpdateBackupStorageParams,
) bool {
	// Construct the combined key for comparison
	toCompare := params.regionOrDefault(currentStorage.Spec.Region) +
		params.bucketNameOrDefault(currentStorage.Spec.Bucket) +
		params.urlOrDefault(currentStorage.Spec.EndpointURL)

	for _, s := range existingStorages.Items {
		if s.Name == currentStorageName {
			continue
		}
		if s.Spec.Region+s.Spec.Bucket+s.Spec.EndpointURL == toCompare {
			return true
		}
	}
	return false
}

func basicStorageParamsAreChanged(bs *everestv1alpha1.BackupStorage, params UpdateBackupStorageParams) bool {
	if params.BucketName != nil && bs.Spec.Bucket != pointer.GetString(params.BucketName) {
		return true
	}
	if params.Region != nil && bs.Spec.Region != pointer.GetString(params.Region) {
		return true
	}
	return false
}

func validateCreateBackupStorageRequest(
	ctx echo.Context,
	l *zap.SugaredLogger,
	existingStorages *everestv1alpha1.BackupStorageList,
) (*CreateBackupStorageParams, error) {
	var params CreateBackupStorageParams
	if err := ctx.Bind(&params); err != nil {
		return nil, err
	}

	for _, storage := range existingStorages.Items {
		if storage.Spec.Region == params.Region &&
			storage.Spec.EndpointURL == pointer.GetString(params.Url) &&
			storage.Spec.Bucket == params.BucketName {
			return nil, errDuplicatedBackupStorage
		}
	}

	if err := validateRFC1035(params.Name, "name"); err != nil {
		return nil, err
	}

	if err := validateBucketName(params.BucketName); err != nil {
		return nil, err
	}

	if params.Url != nil {
		if ok := validateURL(*params.Url); !ok {
			err := ErrInvalidURL("url")
			return nil, err
		}
	}

	if params.Type == CreateBackupStorageParamsTypeS3 {
		if params.Region == "" {
			return nil, errors.New("region is required when using S3 storage type")
		}
	}

	// check data access
	if err := validateStorageAccessByCreate(ctx.Request().Context(), params, l); err != nil {
		l.Error(err)
		return nil, err
	}

	return &params, nil
}

func validateCreateMonitoringInstanceRequest(ctx echo.Context) (*CreateMonitoringInstanceJSONRequestBody, error) {
	var params CreateMonitoringInstanceJSONRequestBody
	if err := ctx.Bind(&params); err != nil {
		return nil, err
	}

	if err := validateRFC1035(params.Name, "name"); err != nil {
		return nil, err
	}

	if ok := validateURL(params.Url); !ok {
		return nil, ErrInvalidURL("url")
	}

	switch params.Type {
	case MonitoringInstanceCreateParamsTypePmm:
		if params.Pmm == nil {
			return nil, fmt.Errorf("pmm key is required for type %s", params.Type)
		}

		if params.Pmm.ApiKey == "" && (params.Pmm.User == "" || params.Pmm.Password == "") {
			return nil, errors.New("pmm.apiKey or pmm.user with pmm.password fields are required")
		}
	default:
		return nil, fmt.Errorf("monitoring type %s is not supported", params.Type)
	}

	return &params, nil
}

func (e *EverestServer) validateUpdateMonitoringInstanceRequest(ctx echo.Context) (*UpdateMonitoringInstanceJSONRequestBody, error) {
	var params UpdateMonitoringInstanceJSONRequestBody
	if err := ctx.Bind(&params); err != nil {
		return nil, err
	}

	if params.Url != "" {
		if ok := validateURL(params.Url); !ok {
			err := ErrInvalidURL("url")
			return nil, err
		}
	}

	if err := validateUpdateMonitoringInstanceType(params); err != nil {
		return nil, err
	}

	return &params, nil
}

func validateUpdateMonitoringInstanceType(params UpdateMonitoringInstanceJSONRequestBody) error {
	switch params.Type {
	case "":
		return nil
	case MonitoringInstanceUpdateParamsTypePmm:
		if params.Pmm == nil {
			return fmt.Errorf("pmm key is required for type %s", params.Type)
		}
	default:
		return errors.New("this monitoring type is not supported")
	}

	return nil
}

func validateCreateDatabaseClusterRequest(dbc DatabaseCluster) error {
	name, _, err := nameFromDatabaseCluster(dbc)
	if err != nil {
		return err
	}

	return validateRFC1035(name, "metadata.name")
}

func nameFromDatabaseCluster(dbc DatabaseCluster) (string, string, error) {
	if dbc.Metadata == nil {
		return "", "", errDBCEmptyMetadata
	}

	md := *dbc.Metadata
	name, ok := md["name"]
	if !ok {
		return "", "", errDBCNameEmpty
	}

	strName, ok := name.(string)
	if !ok {
		return "", "", errDBCNameWrongFormat
	}

	md = *dbc.Metadata
	ns, ok := md["namespace"]
	if !ok {
		return "", "", errDBCNamespaceEmpty
	}

	strNS, ok := ns.(string)
	if !ok {
		return "", "", errDBCNamespaceWrongFormat
	}

	return strName, strNS, nil
}

func (e *EverestServer) validateDatabaseClusterOnCreate(
	ctx echo.Context, namespace string, databaseCluster *DatabaseCluster,
) error {
	user, err := rbac.GetUser(ctx)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}
	schedules := pointer.Get(pointer.Get(pointer.Get(databaseCluster.Spec).Backup).Schedules)
	if len(schedules) > 0 {
		// To be able to create a cluster with backup schedules, the user needs to explicitly
		// have permissions to take backups.
		if err := e.enforce(user, rbac.ResourceDatabaseClusterBackups, rbac.ActionCreate, rbac.ObjectName(namespace, "")); err != nil {
			return err
		}
		// User should be able to read a backup storage to use it in a backup schedule.
		for _, sched := range schedules {
			if err := e.enforce(user, rbac.ResourceBackupStorages, rbac.ActionRead,
				rbac.ObjectName(namespace, sched.BackupStorageName)); err != nil {
				return err
			}
		}
	}

	if err := e.enforceRestoreToNewDBRBAC(ctx.Request().Context(), user, namespace, databaseCluster); err != nil {
		return err
	}
	return nil
}

// To be able to restore a backup to a new cluster, the following permissions are needed:
// - create restores.
// - read database cluster credentials.
func (e *EverestServer) enforceRestoreToNewDBRBAC(
	ctx context.Context, user, namespace string, databaseCluster *DatabaseCluster,
) error {
	sourceBackup := pointer.Get(pointer.Get(pointer.Get(databaseCluster.Spec).DataSource).DbClusterBackupName)
	if sourceBackup == "" {
		return nil
	}

	if err := e.enforce(user, rbac.ResourceDatabaseClusterRestores, rbac.ActionCreate, rbac.ObjectName(namespace, "")); err != nil {
		return err
	}

	// Get the name of the source database cluster.
	bkp, err := e.kubeClient.GetDatabaseClusterBackup(ctx, namespace, sourceBackup)
	if err != nil {
		return errors.Join(err, errors.New("failed to get database cluster backup"))
	}
	sourceDB := bkp.Spec.DBClusterName

	if err := e.enforceDBRestoreRBAC(user, namespace, sourceBackup, sourceDB); err != nil {
		return err
	}
	return nil
}

//nolint:cyclop
func (e *EverestServer) validateDatabaseClusterCR(
	ctx echo.Context, namespace string, databaseCluster *DatabaseCluster,
) error {
	if err := validateCreateDatabaseClusterRequest(*databaseCluster); err != nil {
		return err
	}

	engineName, ok := operatorEngine[everestv1alpha1.EngineType(databaseCluster.Spec.Engine.Type)]
	if !ok {
		return errors.New("unsupported database engine")
	}
	engine, err := e.kubeClient.GetDatabaseEngine(ctx.Request().Context(), namespace, engineName)
	if err != nil {
		return err
	}
	if err := validateVersion(databaseCluster.Spec.Engine.Version, engine); err != nil {
		return err
	}
	if databaseCluster.Spec.Proxy != nil && databaseCluster.Spec.Proxy.Type != nil {
		if err := validateProxy(databaseCluster.Spec.Engine.Type, string(*databaseCluster.Spec.Proxy.Type)); err != nil {
			return err
		}
	}
	if err := validateBackupSpec(databaseCluster); err != nil {
		return err
	}

	if err = e.validateBackupStoragesFor(ctx.Request().Context(), namespace, databaseCluster); err != nil {
		return err
	}

	if databaseCluster.Spec.DataSource != nil {
		if err := validateDBDataSource(databaseCluster); err != nil {
			return err
		}
	}

	if databaseCluster.Spec.Engine.Type == DatabaseClusterSpecEngineType(everestv1alpha1.DatabaseEnginePostgresql) {
		if err = e.validatePGSchedulesRestrictions(ctx.Request().Context(), *databaseCluster); err != nil {
			return err
		}
		if err = validatePGReposForAPIDB(ctx.Request().Context(), databaseCluster, e.kubeClient.ListDatabaseClusterBackups); err != nil {
			return err
		}
	}
	if err := validateSharding(*databaseCluster); err != nil {
		return err
	}
	return validateResourceLimits(databaseCluster)
}

func validateSharding(dbc DatabaseCluster) error {
	if dbc.Spec.Sharding == nil || !dbc.Spec.Sharding.Enabled {
		return nil
	}
	if dbc.Spec.Engine.Type != Psmdb {
		return errShardingIsNotSupported
	}
	if dbc.Spec.Engine.Version == nil {
		return errShardingVersion
	}
	version, err := goversion.NewVersion(*dbc.Spec.Engine.Version)
	if err != nil {
		return errShardingVersion
	}
	if !common.CheckConstraint(version, ">=1.17.0") {
		return errShardingVersion
	}
	if dbc.Spec.Sharding.Shards < minShardsNum {
		return errInsufficientShardsNumber
	}
	if dbc.Spec.Sharding.ConfigServer.Replicas < minConfigServersNum {
		return errInsufficientCfgSrvNumber
	}
	if dbc.Spec.Sharding.ConfigServer.Replicas%2 == 0 {
		return errEvenServersNumber
	}
	return nil
}

func (e *EverestServer) validatePGSchedulesRestrictions(ctx context.Context, newDbc DatabaseCluster) error {
	dbcName, dbcNamespace, err := nameFromDatabaseCluster(newDbc)
	if err != nil {
		return err
	}
	existingDbc, err := e.kubeClient.GetDatabaseCluster(ctx, dbcNamespace, dbcName)
	if err != nil {
		// if there was no such cluster before (creating cluster) - check only the duplicates for storages
		if k8serrors.IsNotFound(err) {
			return checkStorageDuplicates(newDbc)
		}
		return err
	}
	// if there is an old cluster - compare old and new schedules
	return checkSchedulesChanges(*existingDbc, newDbc)
}

func checkStorageDuplicates(dbc DatabaseCluster) error {
	if dbc.Spec == nil || dbc.Spec.Backup == nil || dbc.Spec.Backup.Schedules == nil {
		return nil
	}
	schedules := *dbc.Spec.Backup.Schedules
	storagesMap := make(map[string]bool)
	for _, schedule := range schedules {
		if _, inUse := storagesMap[schedule.BackupStorageName]; inUse {
			return errDuplicatedStoragePG
		}
		storagesMap[schedule.BackupStorageName] = true
	}
	return nil
}

func checkSchedulesChanges(oldDbc everestv1alpha1.DatabaseCluster, newDbc DatabaseCluster) error {
	if newDbc.Spec == nil || newDbc.Spec.Backup == nil || newDbc.Spec.Backup.Schedules == nil {
		return nil
	}
	newSchedules := *newDbc.Spec.Backup.Schedules
	for _, oldSched := range oldDbc.Spec.Backup.Schedules {
		for _, newShed := range newSchedules {
			// check the existing schedule storage wasn't changed
			if oldSched.Name == newShed.Name {
				if oldSched.BackupStorageName != newShed.BackupStorageName {
					return errStorageChangePG
				}
			}
		}
	}
	// check there is no duplicated storages
	return checkStorageDuplicates(newDbc)
}

func (e *EverestServer) validateBackupStoragesFor( //nolint:cyclop
	ctx context.Context,
	namespace string,
	databaseCluster *DatabaseCluster,
) error {
	if databaseCluster.Spec.Backup == nil {
		return nil
	}
	storages := make(map[string]bool)
	for _, schedule := range pointer.Get(databaseCluster.Spec.Backup.Schedules) {
		storages[schedule.BackupStorageName] = true
	}

	if databaseCluster.Spec.Engine.Type == DatabaseClusterSpecEngineType(everestv1alpha1.DatabaseEnginePSMDB) {
		// attempt to configure more than one storage for psmdb
		if len(storages) > 1 {
			return errPSMDBMultipleStorages
		}
		// attempt to use a storage other than the active one
		if databaseCluster.Status != nil {
			activeStorage := databaseCluster.Status.ActiveStorage
			for name := range storages {
				if activeStorage != nil && *activeStorage != "" && name != *activeStorage {
					return errPSMDBViolateActiveStorage
				}
			}
		}
	}

	if databaseCluster.Spec.Backup.Pitr == nil || !databaseCluster.Spec.Backup.Pitr.Enabled {
		return nil
	}

	if databaseCluster.Spec.Engine.Type == DatabaseClusterSpecEngineType(everestv1alpha1.DatabaseEnginePXC) {
		if databaseCluster.Spec.Backup.Pitr.BackupStorageName == nil || *databaseCluster.Spec.Backup.Pitr.BackupStorageName == "" {
			return errPitrNoBackupStorageName
		}
		storage, err := e.kubeClient.GetBackupStorage(ctx, namespace, *databaseCluster.Spec.Backup.Pitr.BackupStorageName)
		if err != nil {
			return err
		}
		// pxc only supports s3 for pitr
		if storage.Spec.Type != everestv1alpha1.BackupStorageTypeS3 {
			return errPXCPitrS3Only
		}
	}

	return nil
}

func validateVersion(version *string, engine *everestv1alpha1.DatabaseEngine) error {
	if version != nil {
		if len(engine.Spec.AllowedVersions) > 0 {
			if !containsVersion(*version, engine.Spec.AllowedVersions) {
				return fmt.Errorf("using %s version for %s is not allowed", *version, engine.Spec.Type)
			}
			return nil
		}
		if _, ok := engine.Status.AvailableVersions.Engine[*version]; !ok {
			return fmt.Errorf("%s is not in available versions list", *version)
		}
	}
	return nil
}

func containsVersion(version string, versions []string) bool {
	if version == "" {
		return true
	}
	for _, allowedVersion := range versions {
		if version == allowedVersion {
			return true
		}
	}
	return false
}

func validateProxy(engineType DatabaseClusterSpecEngineType, proxyType string) error {
	if engineType == DatabaseClusterSpecEngineType(everestv1alpha1.DatabaseEnginePXC) {
		if proxyType != string(everestv1alpha1.ProxyTypeProxySQL) && proxyType != string(everestv1alpha1.ProxyTypeHAProxy) {
			return errUnsupportedPXCProxy
		}
	}

	if engineType == DatabaseClusterSpecEngineType(everestv1alpha1.DatabaseEnginePostgresql) && proxyType != string(everestv1alpha1.ProxyTypePGBouncer) {
		return errUnsupportedPGProxy
	}
	if engineType == DatabaseClusterSpecEngineType(everestv1alpha1.DatabaseEnginePSMDB) && proxyType != string(everestv1alpha1.ProxyTypeMongos) {
		return errUnsupportedPSMDBProxy
	}
	return nil
}

func validateBackupSpec(cluster *DatabaseCluster) error {
	if cluster.Spec.Backup == nil {
		return nil
	}
	if !cluster.Spec.Backup.Enabled {
		return nil
	}
	if cluster.Spec.Backup.Schedules == nil || len(*cluster.Spec.Backup.Schedules) == 0 {
		return errNoSchedules
	}

	if err := validatePitrSpec(cluster); err != nil {
		return err
	}

	for _, schedule := range *cluster.Spec.Backup.Schedules {
		if schedule.Name == "" {
			return errNoNameInSchedule
		}
		if schedule.Enabled && schedule.BackupStorageName == "" {
			return errScheduleNoBackupStorageName
		}
	}
	return checkDuplicateSchedules(*cluster.Spec.Backup.Schedules)
}

type apiSchedule []struct {
	BackupStorageName string `json:"backupStorageName"`
	Enabled           bool   `json:"enabled"`
	Name              string `json:"name"`
	RetentionCopies   *int32 `json:"retentionCopies,omitempty"`
	Schedule          string `json:"schedule"`
}

func checkDuplicateSchedules(schedules apiSchedule) error {
	m := make(map[string]struct{})
	for _, s := range schedules {
		key := s.Schedule
		if _, ok := m[key]; ok {
			return errDuplicatedSchedules
		}
		m[key] = struct{}{}
	}
	return nil
}

func validatePitrSpec(cluster *DatabaseCluster) error {
	if cluster.Spec.Backup.Pitr == nil || !cluster.Spec.Backup.Pitr.Enabled {
		return nil
	}

	if cluster.Spec.Engine.Type == DatabaseClusterSpecEngineType(everestv1alpha1.DatabaseEnginePXC) &&
		(cluster.Spec.Backup.Pitr.BackupStorageName == nil || *cluster.Spec.Backup.Pitr.BackupStorageName == "") {
		return errPitrNoBackupStorageName
	}

	if cluster.Spec.Backup.Pitr.UploadIntervalSec != nil && *cluster.Spec.Backup.Pitr.UploadIntervalSec <= 0 {
		return errPitrUploadInterval
	}

	return nil
}

func validateResourceLimits(cluster *DatabaseCluster) error {
	if err := ensureNonEmptyResources(cluster); err != nil {
		return err
	}
	if err := validateCPU(cluster); err != nil {
		return err
	}
	if err := validateMemory(cluster); err != nil {
		return err
	}
	return validateStorageSize(cluster)
}

func validateDBDataSource(db *DatabaseCluster) error {
	bytes, err := json.Marshal(db.Spec.DataSource)
	if err != nil {
		return errIncorrectDataSourceStruct
	}
	return validateCommonDataSourceStruct(bytes)
}

func validateRestoreDataSource(restore *DatabaseClusterRestore) error {
	bytes, err := json.Marshal(restore.Spec.DataSource)
	if err != nil {
		return errIncorrectDataSourceStruct
	}
	return validateCommonDataSourceStruct(bytes)
}

func validateCommonDataSourceStruct(data []byte) error {
	// marshal and unmarshal to use the same validation func to validate DataSource for both db and restore
	ds := &dataSourceStruct{}
	err := json.Unmarshal(data, ds)
	if err != nil {
		return errIncorrectDataSourceStruct
	}
	return validateDataSource(*ds)
}

func validateDataSource(dataSource dataSourceStruct) error {
	if (dataSource.DbClusterBackupName == nil && dataSource.BackupSource == nil) ||
		(dataSource.DbClusterBackupName != nil && *dataSource.DbClusterBackupName != "" && dataSource.BackupSource != nil) {
		return errDataSourceConfig
	}

	if dataSource.BackupSource != nil {
		if dataSource.BackupSource.BackupStorageName == "" {
			return errDataSourceNoBackupStorageName
		}

		if dataSource.BackupSource.Path == "" {
			return errDataSourceNoPath
		}
	}

	if dataSource.Pitr != nil { //nolint:nestif
		if dataSource.Pitr.Type == nil || *dataSource.Pitr.Type == string(DatabaseClusterSpecDataSourcePitrTypeDate) {
			if dataSource.Pitr.Date == nil {
				return errDataSourceNoPitrDateSpecified
			}

			if _, err := time.Parse(dateFormat, *dataSource.Pitr.Date); err != nil {
				return errDataSourceWrongDateFormat
			}
		} else {
			return errUnsupportedPitrType
		}
	}
	return nil
}

func ensureNonEmptyResources(cluster *DatabaseCluster) error {
	if cluster.Spec.Engine.Resources == nil {
		return errNoResourceDefined
	}
	if cluster.Spec.Engine.Resources.Cpu == nil {
		return errNotEnoughCPU
	}
	if cluster.Spec.Engine.Resources.Memory == nil {
		return errNotEnoughMemory
	}
	return nil
}

func validateCPU(cluster *DatabaseCluster) error {
	cpuStr, err := cluster.Spec.Engine.Resources.Cpu.AsDatabaseClusterSpecEngineResourcesCpu1()
	if err == nil {
		cpu, err := resource.ParseQuantity(cpuStr)
		if err != nil {
			return err
		}
		if cpu.Cmp(minCPUQuantity) == -1 {
			return errNotEnoughCPU
		}
	}
	_, err = cluster.Spec.Engine.Resources.Cpu.AsDatabaseClusterSpecEngineResourcesCpu0()
	if err == nil {
		return errInt64NotSupported
	}
	return nil
}

func validateMemory(cluster *DatabaseCluster) error {
	_, err := cluster.Spec.Engine.Resources.Memory.AsDatabaseClusterSpecEngineResourcesMemory0()
	if err == nil {
		return errInt64NotSupported
	}
	memStr, err := cluster.Spec.Engine.Resources.Memory.AsDatabaseClusterSpecEngineResourcesMemory1()
	if err == nil {
		mem, err := resource.ParseQuantity(memStr)
		if err != nil {
			return err
		}
		if mem.Cmp(minMemQuantity) == -1 {
			return errNotEnoughMemory
		}
	}
	return nil
}

func validateStorageSize(cluster *DatabaseCluster) error {
	_, err := cluster.Spec.Engine.Storage.Size.AsDatabaseClusterSpecEngineStorageSize0()
	if err == nil {
		return errInt64NotSupported
	}
	sizeStr, err := cluster.Spec.Engine.Storage.Size.AsDatabaseClusterSpecEngineStorageSize1()

	if err == nil {
		size, err := resource.ParseQuantity(sizeStr)
		if err != nil {
			return err
		}
		if size.Cmp(minStorageQuantity) == -1 {
			return errNotEnoughDiskSize
		}
	}
	return nil
}

// validateDBEngineVersionUpgrade validates if upgrade of DBEngine from `oldVersion` to `newVersion` is allowed.
func validateDBEngineVersionUpgrade(newVersion, oldVersion string) error {
	// Ensure a "v" prefix so that it is a valid semver.
	if !strings.HasPrefix(newVersion, "v") {
		newVersion = "v" + newVersion
	}
	if !strings.HasPrefix(oldVersion, "v") {
		oldVersion = "v" + oldVersion
	}

	// Check semver validity.
	if !semver.IsValid(newVersion) {
		return errInvalidVersion
	}

	// We will not allow downgrades.
	if semver.Compare(newVersion, oldVersion) < 0 {
		return errDBEngineDowngrade
	}
	// We will not allow major upgrades.
	// Major upgrades are handled differently for different operators, so for now we simply won't allow it.
	// For example:
	// - PXC operator allows major upgrades.
	// - PSMDB operator allows major upgrades, but we need to handle FCV.
	// - PG operator does not allow major upgrades.
	if semver.Major(oldVersion) != semver.Major(newVersion) {
		return errDBEngineMajorVersionUpgrade
	}
	return nil
}

func (e *EverestServer) validateBackupScheduledUpdate(
	user string,
	dbc *DatabaseCluster,
	oldDB *everestv1alpha1.DatabaseCluster,
) error {
	oldSchedules := oldDB.Spec.Backup.Schedules
	newSchedules := []everestv1alpha1.BackupSchedule{}
	schedules := pointer.Get(pointer.Get(pointer.Get(dbc.Spec).Backup).Schedules)
	for _, schedule := range schedules {
		newSchedules = append(newSchedules, everestv1alpha1.BackupSchedule{
			Name:              schedule.Name,
			Enabled:           schedule.Enabled,
			BackupStorageName: schedule.BackupStorageName,
			Schedule:          schedule.Schedule,
			RetentionCopies:   pointer.GetInt32(schedule.RetentionCopies),
		})
	}
	sortFn := func(a, b everestv1alpha1.BackupSchedule) int { return strings.Compare(a.Name, b.Name) }
	slices.SortFunc(oldSchedules, sortFn)
	slices.SortFunc(newSchedules, sortFn)

	isSchedulesEqual := func() bool {
		if len(oldSchedules) != len(newSchedules) {
			return false
		}
		// compare each.
		for i := range oldSchedules {
			if oldSchedules[i].Name != newSchedules[i].Name ||
				oldSchedules[i].Enabled != newSchedules[i].Enabled ||
				oldSchedules[i].BackupStorageName != newSchedules[i].BackupStorageName ||
				oldSchedules[i].Schedule != newSchedules[i].Schedule ||
				oldSchedules[i].RetentionCopies != newSchedules[i].RetentionCopies {
				return false
			}
		}
		return true
	}

	// If the schedules are updated, we need to check that the user has
	// permission to create backups in this namespace.
	if !isSchedulesEqual() {
		if err := e.enforce(user, rbac.ResourceDatabaseClusterBackups, rbac.ActionCreate, rbac.ObjectName(oldDB.GetNamespace(), "")); err != nil {
			return err
		}
	}
	// User should be able to read a backup storage to use it in a backup schedule.
	for _, sched := range newSchedules {
		if err := e.enforce(user, rbac.ResourceBackupStorages, rbac.ActionRead,
			rbac.ObjectName(oldDB.GetNamespace(), sched.BackupStorageName)); err != nil {
			return err
		}
	}
	return nil
}

func (e *EverestServer) validateDatabaseClusterOnUpdate(
	c echo.Context,
	dbc *DatabaseCluster,
	oldDB *everestv1alpha1.DatabaseCluster,
) error {
	newVersion := pointer.Get(dbc.Spec.Engine.Version)
	oldVersion := oldDB.Spec.Engine.Version
	if newVersion != "" && newVersion != oldVersion {
		if err := validateDBEngineVersionUpgrade(newVersion, oldVersion); err != nil {
			return err
		}
	}
	if *dbc.Spec.Engine.Replicas < oldDB.Spec.Engine.Replicas && *dbc.Spec.Engine.Replicas == 1 {
		// XXX: We can scale down multiple node clusters to a single node but we need to set
		// `allowUnsafeConfigurations` to `true`. Having this configuration is not recommended
		// and makes a database cluster unsafe. Once allowUnsafeConfigurations set to true you
		// can't set it to false for all operators and psmdb operator does not support it.
		//
		// Once it is supported by all operators we can revert this.
		return fmt.Errorf("cannot scale down %d node cluster to 1. The operation is not supported", oldDB.Spec.Engine.Replicas)
	}

	if err := validateShardingOnUpdate(dbc, oldDB); err != nil {
		return err
	}

	user, err := rbac.GetUser(c)
	if err != nil {
		return errors.Join(err, errors.New("cannot get user from request context"))
	}
	if err := e.validateBackupScheduledUpdate(user, dbc, oldDB); err != nil {
		return err
	}
	return nil
}

func validateShardingOnUpdate(dbc *DatabaseCluster, oldDB *everestv1alpha1.DatabaseCluster) error {
	if oldDB.Spec.Sharding == nil || !oldDB.Spec.Sharding.Enabled {
		if dbc.Spec.Sharding != nil && dbc.Spec.Sharding.Enabled {
			return errShardingEnablingNotSupported
		}
		return nil
	}
	if dbc.Spec.Sharding == nil || !dbc.Spec.Sharding.Enabled {
		return errDisableShardingNotSupported
	}
	if dbc.Spec.Sharding.Shards != oldDB.Spec.Sharding.Shards {
		return errChangeShardsNumNotSupported
	}
	if dbc.Spec.Sharding.ConfigServer.Replicas != oldDB.Spec.Sharding.ConfigServer.Replicas {
		return errChangeCfgSrvNotSupported
	}
	return validateSharding(*dbc)
}

func (e *EverestServer) validateDatabaseClusterBackup(ctx context.Context, namespace string, backup *DatabaseClusterBackup) error {
	if backup == nil {
		return errors.New("backup cannot be empty")
	}
	if backup.Spec == nil {
		return errors.New(".spec cannot be empty")
	}
	b := &everestv1alpha1.DatabaseClusterBackup{}
	data, err := json.Marshal(backup)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, b); err != nil {
		return err
	}
	if b.Spec.BackupStorageName == "" {
		return errors.New(".spec.backupStorageName cannot be empty")
	}
	if b.Spec.DBClusterName == "" {
		return errors.New(".spec.dbClusterName cannot be empty")
	}
	db, err := e.kubeClient.GetDatabaseCluster(ctx, namespace, b.Spec.DBClusterName)
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return fmt.Errorf("database cluster %s does not exist", b.Spec.DBClusterName)
		}
		return err
	}

	if err = validatePGReposForBackup(ctx, *db, e.kubeClient, *b); err != nil {
		return err
	}

	if db.Spec.Engine.Type == everestv1alpha1.DatabaseEnginePSMDB {
		if db.Status.ActiveStorage != "" && db.Status.ActiveStorage != b.Spec.BackupStorageName {
			return errPSMDBViolateActiveStorage
		}
	}
	return nil
}

func validatePGReposForBackup(ctx context.Context, db everestv1alpha1.DatabaseCluster, kubeClient *kubernetes.Kubernetes, newBackup everestv1alpha1.DatabaseClusterBackup) error {
	if db.Spec.Engine.Type != everestv1alpha1.DatabaseEnginePostgresql {
		return nil
	}

	// convert between k8s and api structure
	str, err := json.Marshal(db)
	if err != nil {
		return err
	}
	apiDB := &DatabaseCluster{}
	if err := json.Unmarshal(str, apiDB); err != nil {
		return err
	}

	// put the backup that being validated to the list of all backups to calculate if the limitations are respected
	getBackupsFunc := func(ctx context.Context, namespace string, options metav1.ListOptions) (*everestv1alpha1.DatabaseClusterBackupList, error) {
		list, err := kubeClient.ListDatabaseClusterBackups(ctx, namespace, options)
		if err != nil {
			return nil, err
		}
		list.Items = append(list.Items, newBackup)
		return list, nil
	}

	if err = validatePGReposForAPIDB(ctx, apiDB, getBackupsFunc); err != nil {
		return err
	}
	return nil
}

func validateDatabaseClusterRestore(ctx context.Context, namespace string, restore *DatabaseClusterRestore, kubeClient *kubernetes.Kubernetes) error {
	if restore == nil {
		return errors.New("restore cannot be empty")
	}
	if restore.Spec == nil {
		return errors.New(".spec cannot be empty")
	}
	r := &everestv1alpha1.DatabaseClusterRestore{}
	data, err := json.Marshal(restore)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, r); err != nil {
		return err
	}
	if r.Spec.DataSource.DBClusterBackupName == "" {
		return errors.New(".spec.dataSource.dbClusterBackupName cannot be empty")
	}
	if r.Spec.DBClusterName == "" {
		return errors.New(".spec.dbClusterName cannot be empty")
	}
	_, err = kubeClient.GetDatabaseCluster(ctx, namespace, r.Spec.DBClusterName)
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return fmt.Errorf("database cluster %s does not exist", r.Spec.DBClusterName)
		}
		return err
	}
	b, err := kubeClient.GetDatabaseClusterBackup(ctx, namespace, r.Spec.DataSource.DBClusterBackupName)
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return fmt.Errorf("backup %s does not exist", r.Spec.DataSource.DBClusterBackupName)
		}
		return err
	}
	_, err = kubeClient.GetBackupStorage(ctx, namespace, b.Spec.BackupStorageName)
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return fmt.Errorf("backup storage %s does not exist",
				b.Spec.BackupStorageName,
			)
		}
		return err
	}
	if err = validateRestoreDataSource(restore); err != nil {
		return err
	}
	return err
}

type dataSourceStruct struct {
	BackupSource *struct {
		BackupStorageName string `json:"backupStorageName"`
		Path              string `json:"path"`
	} `json:"backupSource,omitempty"`
	DbClusterBackupName *string `json:"dbClusterBackupName,omitempty"` //nolint:stylecheck
	Pitr                *struct {
		Date *string `json:"date,omitempty"`
		Type *string `json:"type,omitempty"`
	} `json:"pitr,omitempty"`
}

func validatePGReposForAPIDB(ctx context.Context, dbc *DatabaseCluster, getBackupsFunc func(context.Context, string, metav1.ListOptions) (*everestv1alpha1.DatabaseClusterBackupList, error)) error {
	bs := make(map[string]bool)
	if dbc.Spec != nil && dbc.Spec.Backup != nil && dbc.Spec.Backup.Schedules != nil {
		for _, shed := range *dbc.Spec.Backup.Schedules {
			bs[shed.BackupStorageName] = true
		}
	}

	dbcName, dbcNamespace, err := nameFromDatabaseCluster(*dbc)
	if err != nil {
		return err
	}

	backups, err := getBackupsFunc(ctx, dbcNamespace, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("clusterName=%s", dbcName),
	})
	if err != nil {
		return err
	}

	for _, backup := range backups.Items {
		// repos count is increased only if there wasn't such a BS used
		if _, ok := bs[backup.Spec.BackupStorageName]; !ok {
			bs[backup.Spec.BackupStorageName] = true
		}
	}

	// second check if there are too many repos used.
	if len(bs) > pgReposLimit {
		return errTooManyPGStorages
	}

	return nil
}

func validateMetadata(metadata *map[string]interface{}) error {
	if metadata == nil {
		return errNoMetadata
	}
	m := *metadata
	if _, err := strconv.ParseUint(fmt.Sprint(m["resourceVersion"]), 10, 64); err != nil {
		return errInvalidResourceVersion
	}
	return nil
}

func validateBucketName(s string) error {
	// sanitize: accept only lowercase letters, numbers, dots and hyphens.
	// can be applied to both s3 bucket name and azure container name.
	bucketRegex := `^[a-z0-9\.\-]{3,63}$`
	re := regexp.MustCompile(bucketRegex)
	if !re.MatchString(s) {
		return errInvalidBucketName
	}

	return nil
}
