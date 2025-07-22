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

// Package utils provides utility functions for the Helm.
package utils

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	everesthelmchart "github.com/percona/percona-helm-charts/charts/everest"
	"go.uber.org/zap"
	helmcli "helm.sh/helm/v3/pkg/cli"
	"helm.sh/helm/v3/pkg/cli/values"
	"helm.sh/helm/v3/pkg/getter"
	"helm.sh/helm/v3/pkg/strvals"
)

// MergeVals merges all values from flag options ('helmFlagOpts') and
// auto-generated helm options based on environment ('helmMapOpts'),
// and returns a single map with all of these options merged.
// 'helmMapOpts' can be nil.
func MergeVals(
	helmFlagOpts values.Options,
	helmMapOpts map[string]string,
) (map[string]interface{}, error) {
	// Create helm values from helmMapOpts
	helmOpts := make([]string, 0, len(helmMapOpts))
	for k, v := range helmMapOpts {
		helmOpts = append(helmOpts, fmt.Sprintf("%s=%s", k, v))
	}

	helmOptsStr := strings.Join(helmOpts, ",")

	helmValues := make(map[string]interface{})
	err := strvals.ParseInto(helmOptsStr, helmValues)
	if err != nil {
		return nil, fmt.Errorf("error parsing helm options %q: %w", helmOptsStr, err)
	}

	// Get the user-defined helm options passed by flag
	p := getter.All(helmcli.New())
	userVals, err := helmFlagOpts.MergeValues(p)
	if err != nil {
		return nil, err
	}

	// User-defined helm options will overwrite the default helm options.
	return MergeMaps(helmValues, userVals), nil
}

// MergeMaps recursively merges the values of b into a copy of a, preferring the values from b.
func MergeMaps(a, b map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(a))
	for k, v := range a {
		out[k] = v
	}
	for k, v := range b {
		if v, ok := v.(map[string]interface{}); ok {
			if bv, ok := out[k]; ok {
				if bv, ok := bv.(map[string]interface{}); ok {
					out[k] = MergeMaps(bv, v)
					continue
				}
			}
		}
		out[k] = v
	}
	return out
}

// copies the contents of src embed.FS to the dest directory.
func copyEmbedFSToDir(src embed.FS, dest string) error {
	return fs.WalkDir(src, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		targetPath := filepath.Join(dest, path)
		if d.IsDir() {
			if err := os.MkdirAll(targetPath, os.ModePerm); err != nil { //nolint:gosec
				return err
			}
		} else {
			data, err := src.ReadFile(path)
			if err != nil {
				return err
			}

			if err := os.WriteFile(targetPath, data, os.ModePerm); err != nil { //nolint:gosec
				return err
			}
		}
		return nil
	})
}

// Returns a temporary directory with the Everest Helm chart files
// from the main branch of the [percona-helm-charts](https://github.com/percona/percona-helm-charts) repository.
// It copies the files from the exported embed.FS into a temporary directory.
// The caller is responsible for cleaning up the directory.
func devChart() (string, error) {
	tmp, err := os.MkdirTemp("", "everest-dev-chart")
	if err != nil {
		return "", err
	}
	// We need to copy the contents of the embed.FS to the temporary directory
	// so that we're able to use the Helm SDK to build the chart dependencies.
	// Currently Helm SDK does not support reading a chart from embed.FS to build dependencies.
	if err := copyEmbedFSToDir(everesthelmchart.Chart, tmp); err != nil {
		if removeErr := os.RemoveAll(tmp); removeErr != nil {
			return "", errors.Join(err, removeErr)
		}
		return "", err
	}
	// The Helm chart contains CRDs that are symlinked to the everest-crds sub-chart.
	// However, we use EmbedFS to reference the chart files, but EmbedFS does not honor symlinks.
	// So we need to re-create them by calling the `make link-crds` command.
	if err := makeCRDSymlink(tmp); err != nil {
		return "", err
	}
	return tmp, nil
}

// Runs `make link-crds` in the chartDir.
func makeCRDSymlink(chartDir string) error {
	cmd := exec.Command("make", "link-crds")
	cmd.Dir = chartDir
	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to link CRDs: %w", err)
	}
	return nil
}

// SetupEverestDevChart sets up the development chart for Everest.
// Returns a clean-up function that should be called when the chart is no longer needed.
func SetupEverestDevChart(l *zap.SugaredLogger, path *string) (func(), error) {
	if path == nil {
		return nil, fmt.Errorf("path is nil")
	}
	der, err := devChart()
	if err != nil {
		return nil, fmt.Errorf("error setting up Everest dev chart: %w", err)
	}
	l.Infof("Copied dev chart to '%s' ", der)
	*path = der
	return func() {
		if err := os.RemoveAll(der); err != nil {
			l.Error("Error removing dev chart directory: %v", err)
		}
	}, nil
}

// YAMLStringsToBytes converts a slice of YAML strings to a single byte slice.
func YAMLStringsToBytes(strs []string) []byte {
	var builder strings.Builder
	for _, s := range strs {
		builder.WriteString(s + "\n---\n")
	}
	s := builder.String()
	s = strings.TrimSuffix(s, "\n---\n")
	return []byte(s)
}
