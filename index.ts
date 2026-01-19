import * as vortex from 'vortex-api';
import * as path from 'path';
import Promise from 'bluebird';
import { fs, log, util } from 'vortex-api';


const GAME_ID = 'plantsvszombiesreplanted';
const STEAMAPP_ID = '3654560';

const MOD_FILE_EXT = '.dll';
const ML_DLL = 'MelonLoader.dll';
const ML_MODPAGE = 'https://melonwiki.xyz';
const ML_DOWNLOADPAGE = 'https://github.com/LavaGang/MelonLoader/releases/latest';


// -------------------------------------
//#region Register Game
// -------------------------------------

function main(context: vortex.types.IExtensionContext): boolean {
    // Register your game here
    context.registerGame({
        id: GAME_ID,
        name: 'Plants vs Zombies: Replanted',
        mergeMods: true,
        queryPath: findGame,
        supportedTools: [],
        queryModPath: () => 'Mods',
        logo: 'gameart.jpg',
        executable: () => 'Replanted.exe',
        requiredFiles: [
            'Replanted.exe',
            'GameAssembly.dll',
        ],
        setup: (discovery) => prepareForModding(discovery, context.api),
        environment: { SteamAPPId: STEAMAPP_ID },
        details: { steamAppId: STEAMAPP_ID },
    });

    // Register mod installer
    context.registerInstaller('pvzre-mod', 25, testSupportedContent, installContent);

    return true;
}

function findGame(): Promise<string> {
    return util.GameStoreHelper.findByAppId([STEAMAPP_ID])
        .then((game: vortex.types.IGameStoreEntry) => game.gamePath);
}

function prepareForModding(discovery: vortex.types.IDiscoveryResult, api: vortex.types.IExtensionApi): Promise<void> {
    // Path to the main MelonLoader DLL file.
    const qModPath = path.join(discovery.path!, 'MelonLoader', 'net6', ML_DLL);
    // Ensure the mods folder exists, then check for ML.
    return fs.ensureDirWritableAsync(path.join(discovery.path!, 'Mods'))
        .then(() => checkForML(api, qModPath));
}

function checkForML(api: vortex.types.IExtensionApi, qModPath: string): Promise<void> {
    return fs.statAsync(qModPath)
        .then(() => undefined)
        .catch(() => {
            api.sendNotification!({
                id: 'ml-missing',
                type: 'warning',
                title: 'MelonLoader not installed',
                message: 'MelonLoader is required to mod Plants vs Zombies: Replanted.',
                actions: [{ title: 'Get MelonLoader', action: () => util.opn(ML_DOWNLOADPAGE).catch(() => undefined) }],
            });
            return undefined;
        });
}
//#endregion


// -------------------------------------
//#region Mod installers
// -------------------------------------

const testSupportedContent: vortex.types.TestSupported = (files, gameId) => {
    // Make sure we're able to support this mod.
    const supported =
        (gameId === GAME_ID) &&
        (files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT) !== undefined);
    return Promise.resolve({ supported, requiredFiles: [] });
};

const installContent: vortex.types.InstallFunc = (files) => {
    // The .dll file is expected to always be positioned in the mods directory we're going to disregard anything placed outside the root.
    const modFile = files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT)!;
    const idx = modFile.indexOf(path.basename(modFile));
    const rootPath = path.dirname(modFile);

    // Remove directories and anything that isn't in the rootPath.
    const filtered = files.filter(file =>
        (file.indexOf(rootPath) !== -1) && (!file.endsWith(path.sep)));

    const instructions: vortex.types.IInstruction[] = filtered.map(file => ({
        type: 'copy',
        source: file,
        destination: path.join(file.substr(idx)),
    }));

    return Promise.resolve({ instructions });
};
//#endregion

export default main;
