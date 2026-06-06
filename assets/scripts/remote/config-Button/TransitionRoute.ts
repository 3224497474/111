import { Enum } from 'cc';
import type { IRemoteSceneLoaderTips } from '../RemoteSceneLoader';
import type { ITransitionBundleInput } from '../TransitionManager';

export enum RouteType {
    None = 0,
    HomeToBattle = 1,
    BattleToHome = 2,
    HomeToStory = 3,
    HomeTouserfirstinput=4
}

Enum(RouteType);

export interface IRouteConfig {
    sceneName: string;
    bundles: ITransitionBundleInput[];
    tips?: IRemoteSceneLoaderTips;
    unloadBundles?: string[];
}

export const RouteMap: Record<RouteType, IRouteConfig | null> = {
    [RouteType.None]: null,
    [RouteType.HomeToBattle]: {
        sceneName: 'Battle',
        unloadBundles: ['home'],
        bundles: [
            {
                bundleName: 'Battle',
                prefabPaths: [
                    'prefabs/000001',
                    'prefabs/010001',
                    'prefabs/020001',
                    'prefabs/unitHud',
                ],
            },
        ],
        tips: {
            preparing: 'Preparing battle resources',
            downloading: 'Loading battle resources',
            entering: 'Entering battle',
            failed: 'Failed to load battle resources',
        },
    },
    [RouteType.BattleToHome]: {
        sceneName: 'home',
        unloadBundles: ['Battle'],
        bundles: [
            {
                bundleName: 'home',
                prefabPaths: [
                    'prefabs/Home',
                ],
            },
        ],
        tips: {
            preparing: 'Preparing home resources',
            downloading: 'Loading home resources',
            entering: 'Returning to home',
            failed: 'Failed to load home resources',
        },
    },
    [RouteType.HomeToStory]: {
        sceneName: 'StoryScene',
        bundles: [
            {
                bundleName: 'story',
                prefabPaths: [
                    'prefabs/StoryRoot',
                    'prefabs/StoryDialogPanel',
                    'prefabs/ChapterSelectPanel',
                ],
            },
        ],
        tips: {
            preparing: 'Preparing story resources',
            downloading: 'Loading story resources',
            entering: 'Entering story',
            failed: 'Failed to load story resources',
        },
    },
    [RouteType.HomeTouserfirstinput]:{
        sceneName: 'userfirstinput',
        bundles: [
            {
                bundleName: 'firstUI',
                prefabPaths: [
                    'prefabs/home',
                ],
            },
        ],
        tips: {
            preparing: 'Preparing firstUI resources',
            downloading: 'Loading firstUI resources',
            entering: 'Entering firstUI',
            failed: 'Failed to load firstUI resources',
        },
    }
};
