# AWS App Mesh Add-on

[AWS App Mesh](https://aws.amazon.com/app-mesh/) is a service mesh that makes it easy to monitor and control services.The App Mesh add-on provisions the necessary AWS resources and Helm charts into an EKS cluster that are needed to support App Mesh for EKS workloads. 

Full documentation on using App Mesh with EKS [can be found here](https://docs.aws.amazon.com/app-mesh/latest/userguide/getting-started-kubernetes.html).

## Usage

```typescript
import { AppMeshAddOn, ClusterAddOn, EksBlueprint }  from '@shapirov/cdk-eks-blueprint';

const appMeshAddOn = new AppMeshAddOn();
const addOns: Array<ClusterAddOn> = [ appMeshAddOn ];

const app = new cdk.App();
new EksBlueprint(app, 'my-stack-name', addOns, [], {
  env: {    
      account: <AWS_ACCOUNT_ID>,
      region: <AWS_REGION>,
  },
});
```

## App Mesh Sidecar Injection

You can configure certain namespaces for automatic injection of App Mesh sidecar (Envoy) proxy. This will enable handling cross-cutting aspects such as service to service communication, resiliency patterns (Circuit breaker/retries) as well handle ingress and egress for the workloads running in the namespace.

Here is an example of a team with a namespace configured for automatic sidecar injection:

```typescript
export class TeamBurnhamSetup extends ApplicationTeam {
    constructor(scope: Construct) {
        super({
            name: "burnham",
            users: getUserArns(scope, "team-burnham.users"),
            namespaceAnnotations: {
                "appmesh.k8s.aws/sidecarInjectorWebhook": "enabled"
            }
        });
    }
}
```
## Tracing Integration

App Mesh integrates with a number of tracing providers for distributed tracing support. At the moment it supports AWS X-Ray, Jaeger and Datadog providers. 
X-Ray integration at present requires either a managed node group or a self-managed auto-scaling group backed by EC2. Fargate is not supported. 

Enabling integration:

```typescript
const appMeshAddOn = new ssp.AppMeshAddOn({enableTracing: true, tracingProvider: "x-ray"}),
```

When configured, App Mesh will automatically inject an XRay sidecar to handle tracing which enables troubleshooting latency issues.

## App Mesh and XRay Integration Example

`team-burnham` sample workload repository is configured with an [example workload](https://github.com/aws-samples/ssp-eks-workloads/tree/master/teams/team-burnham/dev) that demonstrates meshified workloads with SSP. 

After workload is bootstrapped with ArgoCD or applied directly to the cluster in `team-burnham` namespace it will create a [DJ application](https://github.com/aws/aws-app-mesh-examples/tree/main/examples/apps/djapp) similar to the one used for the [EKS Workshop](https://www.eksworkshop.com/intermediate/330_app_mesh/). 
It was adapted for GitOps integration with SSP and relies on automatic sidecar injection as well as tracing integration with App Mesh.

After the workload is deployed you can generate some traffic to populated traces:

```bash
$ export DJ_POD_NAME=$(kubectl get pods -n team-burnham -l app=dj -o jsonpath='{.items[].metadata.name}')
$ kubectl -n team-burnham exec -it ${DJ_POD_NAME} -c dj bash
$ while true; do
  curl http://jazz.team-burnham.svc.cluster.local:9080/
  echo
  curl http://metal.team-burnham.svc.cluster.local:9080/
  echo
done
```

The above script will start producing traces with XRay. Once traces are produced (for a minute or more) you can navigate to the AWS XRay console and click on Service Map. 
You will see a screenshot similar to this:

![App Mesh XRay Service Map](/assets/images/appmesh-xray.png)

## Functionality

1. Creates an App Mesh IAM service account.
2. Adds both `AWSCloudMapFullAccess` and `AWSAppMeshFullAccess` roles to the service account.
3. Adds `AWSXRayDaemonWriteAccess` to the instance role if XRay integration is enabled.
4. Creates the `appmesh-system` namespace.
5. Deploys the [`appmesh-controller`](https://github.com/aws/eks-charts/tree/master/stable/appmesh-controller) Helm chart into the cluster.
