package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/AlekSi/pointer"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	corev1 "k8s.io/api/core/v1"

	"github.com/percona/everest/pkg/common"
	"github.com/percona/everest/pkg/rbac"
)

// GetUserPermissions returns the permissions for the currently logged in user.
func (e *EverestServer) GetUserPermissions(c echo.Context) error {
	user, err := rbac.GetUser(c)
	if err != nil {
		e.l.Error("Failed to get user from context: ", zap.Error(err))
		return err
	}

	permissions, err := e.rbacEnforcer.GetImplicitPermissionsForUser(user)
	if err != nil {
		e.l.Error("Failed to get implicit permissions: ", zap.Error(err))
		return err
	}

	if err := e.resolveRoles(user, permissions); err != nil {
		e.l.Error(err)
		return err
	}
	result := pointer.To(permissions)

	rbacCM, err := e.getEverestRBACConfigMap(c.Request().Context())
	if err != nil {
		e.l.Error("Failed to get Everest RBAC ConfigMap", zap.Error(err))
		return err
	}
	enabled := rbac.IsEnabled(rbacCM)
	if !enabled {
		result = nil
	}

	return c.JSON(http.StatusOK, &UserPermissions{
		Permissions: result,
		Enabled:     enabled,
	})
}

// For a given set of `permissions` for a `user`, this function
// will resolve all roles for the user.
func (e *EverestServer) resolveRoles(user string, permissions [][]string) error {
	userRoles, err := e.rbacEnforcer.GetRolesForUser(user)
	if err != nil {
		return errors.Join(err, errors.New("cannot get user roles"))
	}
	for _, role := range userRoles {
		for i, perm := range permissions {
			if perm[0] == role {
				permissions[i][0] = user
			}
		}
	}
	return nil
}

func (e *EverestServer) getEverestRBACConfigMap(ctx context.Context) (*corev1.ConfigMap, error) {
	cm, err := e.kubeClient.GetConfigMap(ctx, common.SystemNamespace, common.EverestRBACConfigMapName)
	if err != nil {
		return nil, errors.Join(err, errors.New("could not get Everest RBAC ConfigMap"))
	}
	return cm, nil
}
