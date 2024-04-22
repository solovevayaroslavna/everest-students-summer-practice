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

// Package api ...
package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/AlekSi/pointer"
	"github.com/labstack/echo/v4"
	"golang.org/x/mod/semver"

	everestv1alpha1 "github.com/percona/everest-operator/api/v1alpha1"
)

const (
	databaseEngineKind = "databaseengines"
)

// ListDatabaseEngines List of the available database engines on the specified namespace.
func (e *EverestServer) ListDatabaseEngines(ctx echo.Context, namespace string) error {
	return e.proxyKubernetes(ctx, namespace, databaseEngineKind, "")
}

// GetDatabaseEngine Get the specified database engine on the specified namespace.
func (e *EverestServer) GetDatabaseEngine(ctx echo.Context, namespace, name string) error {
	return e.proxyKubernetes(ctx, namespace, databaseEngineKind, name)
}

// UpdateDatabaseEngine Update the specified database engine on the specified namespace.
func (e *EverestServer) UpdateDatabaseEngine(ctx echo.Context, namespace, name string) error {
	dbe := &DatabaseEngine{}
	if err := e.getBodyFromContext(ctx, dbe); err != nil {
		e.l.Error(err)
		return ctx.JSON(http.StatusBadRequest, Error{
			Message: pointer.ToString("Could not get DatabaseEngine from the request body"),
		})
	}

	if err := validateMetadata(dbe.Metadata); err != nil {
		return ctx.JSON(http.StatusBadRequest, Error{Message: pointer.ToString(err.Error())})
	}
	return e.proxyKubernetes(ctx, namespace, databaseEngineKind, name)
}

// UpgradeDatabaseEngineOperator upgrades the database engine operator to the specified version.
func (e *EverestServer) UpgradeDatabaseEngineOperator(ctx echo.Context, namespace string, name string) error {
	// Parse request body.
	req := &DatabaseEngineOperatorUpgradeParams{}
	if err := e.getBodyFromContext(ctx, req); err != nil {
		e.l.Error(err)
		return ctx.JSON(http.StatusBadRequest, Error{
			Message: pointer.ToString(
				"Could not get DatabaseEngineOperatorUpgradeParams from the request body"),
		})
	}
	if err := validateDatabaseEngineOperatorUpgradeParams(req); err != nil {
		return ctx.JSON(http.StatusBadRequest, Error{
			Message: pointer.ToString(err.Error()),
		})
	}
	// Get existing database engine.
	dbEngine, err := e.kubeClient.GetDatabaseEngine(ctx.Request().Context(), namespace, name)
	if err != nil {
		return err
	}
	// Update annotation to start upgrade.
	annotations := dbEngine.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}
	annotations[everestv1alpha1.DatabaseOperatorUpgradeAnnotation] = req.TargetVersion
	dbEngine.SetAnnotations(annotations)
	_, err = e.kubeClient.UpdateDatabaseEngine(ctx.Request().Context(), namespace, dbEngine)
	if err != nil {
		return err
	}
	return nil
}

func validateDatabaseEngineOperatorUpgradeParams(req *DatabaseEngineOperatorUpgradeParams) error {
	targetVersion := req.TargetVersion
	if !strings.HasPrefix(targetVersion, "v") {
		targetVersion = "v" + targetVersion
	}
	if !semver.IsValid(targetVersion) {
		return fmt.Errorf("invalid target version '%s'", req.TargetVersion)
	}
	return nil
}
