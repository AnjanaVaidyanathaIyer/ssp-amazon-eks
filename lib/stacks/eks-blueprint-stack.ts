
import * as cdk from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import { StackProps } from '@aws-cdk/core';
import { IVpc, Vpc } from '@aws-cdk/aws-ec2';
import { KubernetesVersion } from '@aws-cdk/aws-eks';
import { EC2ClusterProvider } from '../cluster-providers/ec2-cluster-provider';
import { ClusterAddOn, Team, ClusterProvider, ClusterPostDeploy } from '../spi';

export class EksBlueprintProps {

    /**
     * The id for the blueprint.
     */
    readonly id: string;

    /**
     * Defaults to id if not provided
     */
    readonly name?: string;

    /**
     * Add-ons if any.
     */
    readonly addOns?: Array<ClusterAddOn> = [];

    /**
     * Teams if any
     */
    readonly teams?: Array<Team> = [];

    /**
     * EC2 or Fargate are supported in the blueprint but any implementation conforming the interface
     * will work
     */
    readonly clusterProvider?: ClusterProvider = new EC2ClusterProvider();

    /**
     * Kubernetes version (must be initialized for addons to work properly)
     */
    readonly version?: KubernetesVersion = KubernetesVersion.V1_20;

    /**
     * VPC
     */
    readonly vpc?: Vpc;
}

/**
 * Entry point to the platform provisioning. Creates a CFN stack based on the provided configuration
 * and orcherstrates provisioning of add-ons, teams and post deployment hooks. 
 */
export class EksBlueprint extends cdk.Stack {

    constructor(scope: cdk.Construct, blueprintProps: EksBlueprintProps, props?: StackProps) {
        super(scope, blueprintProps.id, props);

        this.validateInput(blueprintProps);
        /*
        * Supported parameters
        */
        let vpc: IVpc;
        if (blueprintProps.vpc) {
            vpc = blueprintProps.vpc;
        }
        else {
            const vpcId = this.node.tryGetContext("vpc");
            vpc = this.initializeVpc(vpcId);
        }
        const clusterProvider = blueprintProps.clusterProvider ?? new EC2ClusterProvider();

<<<<<<< HEAD
        const clusterInfo = clusterProvider.createCluster(this, vpc, blueprintProps.version ?? KubernetesVersion.V1_19);
=======
        const clusterInfo = clusterProvider.createCluster(this, vpc, blueprintProps.version ?? KubernetesVersion.V1_20);

>>>>>>> aee1f065 (updating cluster version to 1.20)
        const postDeploymentSteps = Array<ClusterPostDeploy>();
        const promises = Array<Promise<cdk.Construct>>();
        const addOnKeys: string[] = [];

        for (let addOn of (blueprintProps.addOns ?? [])) { // must iterate in the strict order
            const result = addOn.deploy(clusterInfo);
            if(result) {
                promises.push(result);
                addOnKeys.push(addOn.constructor.name);
            }
            const postDeploy : any = addOn;
            if((postDeploy as ClusterPostDeploy).postDeploy !== undefined) {
                postDeploymentSteps.push(<ClusterPostDeploy>postDeploy);
            }
        }

        // Wait for all addon promises to be resolved
        Promise.all(promises.values()).then((constructs) => {
            constructs.forEach( (construct, index) => {
                clusterInfo.addProvisionedAddOn(addOnKeys[index], construct);
            });
            if (blueprintProps.teams != null) {
                for(let team of blueprintProps.teams) {
                    team.setup(clusterInfo);
                }
            }
            for(let step of postDeploymentSteps) {
                step.postDeploy(clusterInfo, blueprintProps.teams ?? []);
            }
        }).catch(err => { throw new Error(err)});
    }

    private validateInput(blueprintProps: EksBlueprintProps) {
        const teamNames = new Set<string>();
        if (blueprintProps.teams) {
            blueprintProps.teams.forEach(e => {
                if (teamNames.has(e.name)) {
                    throw new Error(`Team ${e.name} is registered more than once`);
                }
                teamNames.add(e.name);
            });
        }
    }

    initializeVpc(vpcId: string): IVpc {
        const id = this.node.id;
        let vpc = undefined;

        if (vpcId != null) {
            if (vpcId === "default") {
                console.log(`looking up completely default VPC`);
                vpc = ec2.Vpc.fromLookup(this, id + "-vpc", { isDefault: true });
            } else {
                console.log(`looking up non-default ${vpcId} VPC`);
                vpc = ec2.Vpc.fromLookup(this, id + "-vpc", { vpcId: vpcId });
            }
        }

        if (vpc == null) {
            // It will automatically divide the provided VPC CIDR range, and create public and private subnets per Availability Zone.
            // Network routing for the public subnets will be configured to allow outbound access directly via an Internet Gateway.
            // Network routing for the private subnets will be configured to allow outbound access via a set of resilient NAT Gateways (one per AZ).
            vpc = new ec2.Vpc(this, id + "-vpc");
        }

        return vpc;
    }
}