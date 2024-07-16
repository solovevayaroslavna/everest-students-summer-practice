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

// Package configmapadapter provides a Casbin adapter that uses a Kubernetes ConfigMap as the storage.
package configmapadapter

import (
	"context"
	"errors"
	"strings"

	"github.com/casbin/casbin/v2/model"
	"go.uber.org/zap"
	"k8s.io/apimachinery/pkg/types"

	"github.com/percona/everest/pkg/kubernetes"
	rbacutils "github.com/percona/everest/pkg/rbac/utils"
)

// Adapter is the ConfigMap adapter for Casbin.
// It can load policy from ConfigMap and save policy to ConfigMap.
type Adapter struct {
	kubeClient     *kubernetes.Kubernetes
	namespacedName types.NamespacedName
	l              *zap.SugaredLogger
}

// New constructs a new adapter that manages a policy inside a ConfigMap.
func New(
	l *zap.SugaredLogger,
	kubeClient *kubernetes.Kubernetes,
	namespacedName types.NamespacedName,
) *Adapter {
	return &Adapter{
		kubeClient:     kubeClient,
		namespacedName: namespacedName,
		l:              l,
	}
}

// LoadPolicy loads all policy rules from the storage.
func (a *Adapter) LoadPolicy(model model.Model) error {
	cm, err := a.kubeClient.GetConfigMap(
		context.Background(),
		a.namespacedName.Namespace,
		a.namespacedName.Name,
	)
	if err != nil {
		return err
	}

	data, ok := cm.Data["policy.csv"]
	if !ok {
		return errors.New("policy.csv not found in ConfigMap")
	}

	if data == "" {
		return nil
	}

	strs := strings.Split(data, "\n")
	for _, str := range strs {
		if str == "" {
			continue
		}
		if err := rbacutils.LoadPolicyLine(str, model); err != nil {
			a.l.Error("failed to load policy", zap.Error(err))
			return err
		}
	}
	return nil
}

// SavePolicy saves all policy rules to the storage.
func (a *Adapter) SavePolicy(_ model.Model) error {
	return errors.New("not implemented")
}

// AddPolicy adds a policy rule to the storage.
func (a *Adapter) AddPolicy(_ string, _ string, _ []string) error {
	return errors.New("not implemented")
}

// RemovePolicy removes a policy rule from the storage.
func (a *Adapter) RemovePolicy(_ string, _ string, _ []string) error {
	return errors.New("not implemented")
}

// RemoveFilteredPolicy removes policy rules that match the filter from the storage.
func (a *Adapter) RemoveFilteredPolicy(_ string, _ string, _ int, _ ...string) error {
	return errors.New("not implemented")
}
