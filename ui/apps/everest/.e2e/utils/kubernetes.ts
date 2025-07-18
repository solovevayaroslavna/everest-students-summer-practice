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

import { execSync } from 'child_process';

export const getK8sUid = async () => {
  try {
    const command = `kubectl get namespace kube-system -o jsonpath='{.metadata.uid}'`;
    const output = execSync(command).toString();
    return output;
  } catch (error) {
    console.error(`Error executing command: ${error}`);
    throw error;
  }
};

export const getK8sResource = async (
  resourceType: string,
  resourceName: string,
  namespace: string
) => {
  try {
    if (resourceType === 'postgresql') {
      resourceType = 'pg';
    }
    const command = `kubectl get --namespace ${namespace} ${resourceType} ${resourceName} -ojson`;
    const output = execSync(command);
    return JSON.parse(output.toString());
  } catch (error) {
    console.error(`Error executing command: ${error}`);
    throw error;
  }
};

export const deleteAllK8sPVCs = async (namespace: string) => {
  try {
    const command = `kubectl delete --namespace ${namespace} pvc --all --timeout=30s || true`;
    execSync(command);
    console.log(`All PVCs deleted in namespace ${namespace}`);
  } catch (error) {
    console.error(`Error executing command: ${error}`);
    throw error;
  }
};

export const getK8sNodes = async () => {
  try {
    const command = `kubectl get nodes -o jsonpath='{.items[*].metadata.name}'`;
    const output = execSync(command).toString();
    return output.split(' ');
  } catch (error) {
    console.error(`Error executing command: ${error}`);
    throw error;
  }
};

export const addLabelToK8sNode = async (
  nodeName: string,
  labelKey: string,
  labelValue: string
) => {
  try {
    const command = `kubectl label nodes ${nodeName} ${labelKey}=${labelValue}`;
    execSync(command);
    console.log(`Label ${labelKey}=${labelValue} added to node ${nodeName}`);
  } catch (error) {
    console.error(`Error adding label to node: ${error}`);
    throw error;
  }
};

export const removeLabelFromK8sNode = async (
  nodeName: string,
  labelKey: string
) => {
  try {
    const command = `kubectl label nodes ${nodeName} ${labelKey}-`;
    execSync(command);
    console.log(`Label ${labelKey} removed from node ${nodeName}`);
  } catch (error) {
    console.error(`Error removing label from node: ${error}`);
    throw error;
  }
};
