/**
 * Migration script for Genesys scene, prefab, and material files.
 *
 * Migration order: Scenes → Prefabs → Materials
 * This order is important because the engine cannot load new prefab data with old scene data.
 *
 * The migration runs TWICE:
 * - Pass 1: Updates all files to the new format
 * - Pass 2: Re-processes all files to ensure prefab instances in scenes are saved correctly
 *           (prefab instances are only serialized properly when both the prefab and scene
 *           data are at the same version)
 *
 * Usage: pnpm migrate (requires running `pnpm build` first to compile game classes)
 */

import fs from 'fs';
import path from 'path';

import * as ENGINE from '@gnsx/genesys.js';

import { getProjectRoot } from './common.js';
import { StorageProvider } from './storageProvider.js';

// Import game module to register game classes (tsx compiles TypeScript on the fly)
import '../../src/game.js';

// Set up storage provider for file operations
const storageProvider = new StorageProvider();
ENGINE.projectContext({ project: 'local-project', storageProvider: storageProvider });


interface FileInfo {
  path: string;
  type: 'scene' | 'prefab' | 'material';
}

const defaultWorldOptions: ENGINE.WorldOptions = {
  headless: true,
  backgroundColor: 0x2E2E2E,
  physicsOptions: {
    engine: ENGINE.PhysicsEngine.Rapier,
    gravity: ENGINE.MathHelpers.makeVector({ up: -9.81 }),
  },
  navigationOptions: {
    engine: ENGINE.NavigationEngine.RecastNavigation,
  },
  useManifold: true
};

function findScenesAndPrefabs(dir: string, files: FileInfo[] = []): FileInfo[] {
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip common directories that shouldn't be processed
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === '.engine') {
        continue;
      }
      findScenesAndPrefabs(fullPath, files);
    } else if (entry.endsWith('.genesys-scene')) {
      files.push({ path: fullPath, type: 'scene' });
    } else if (entry.endsWith('.prefab.json')) {
      files.push({ path: fullPath, type: 'prefab' });
    } else if (entry.endsWith('.material.json')) {
      files.push({ path: fullPath, type: 'material' });
    }
  }

  return files;
}

async function migrateSceneFile(data: any, filePath: string, relativePath: string): Promise<boolean> {
  // Create a world and load into it
  const world = new ENGINE.World(defaultWorldOptions);

  if (ENGINE.isLegacyData(data)) {
    // Use WorldSerializer for legacy data
    await ENGINE.WorldSerializer.loadWorld(world, data);
  } else {
    // Use Loader for new format
    const loader = new ENGINE.Loader();
    await loader.loadToInstanceAsync(data, world);
  }

  // Dump the world
  const dumper = new ENGINE.Dumper();
  const newData = dumper.dump(world);

  // Write back to file
  const newContent = JSON.stringify(newData, null, 2);
  fs.writeFileSync(filePath, newContent, 'utf-8');

  console.log(`✅ ${relativePath}`);
  return true;
}

async function migratePrefabFile(data: any, filePath: string, relativePath: string): Promise<boolean> {
  let instance: any;

  if (ENGINE.isLegacyData(data)) {
    // Use WorldSerializer for legacy data
    console.log(`🔍 Migrating legacy prefab: ${relativePath}`);
    instance = await ENGINE.WorldSerializer.loadActor(data);
    console.log(`✅ ${relativePath}`);
  } else {
    // Use Loader for new format
    const loader = new ENGINE.Loader();
    instance = await loader.loadAsync(data);
  }

  if (!instance) {
    console.log(`⚠️  ${relativePath}: Loaded instance is null, skipping`);
    return false;
  }

  // Dump using Dumper
  const dumper = new ENGINE.Dumper({flags: ENGINE.DumperFlags.AsPrefab});
  const newData = dumper.dump(instance);

  // Write back to file
  const newContent = JSON.stringify(newData, null, 2);
  fs.writeFileSync(filePath, newContent, 'utf-8');

  console.log(`✅ ${relativePath}`);
  return true;
}

async function migrateMaterialFile(data: any, filePath: string, relativePath: string): Promise<boolean> {
  let material: any;

  if (ENGINE.isLegacyData(data)) {
    console.log(`🔍 Migrated legacy material: ${relativePath}`);
    material = ENGINE.WorldSerializer.importObject(data);
    console.log(`✅ ${relativePath}`);
  } else {
    const loader = new ENGINE.Loader();
    material = await loader.loadAsync(data);
  }

  if (!material) {
    console.log(`⚠️  ${relativePath}: Loaded material is null, skipping`);
    return false;
  }

  // Dump using Dumper
  const dumper = new ENGINE.Dumper({flags:ENGINE.DumperFlags.AsPrefab});
  const newData = dumper.dump(material);
  // Write back to file
  const newContent = JSON.stringify(newData, null, 2);
  fs.writeFileSync(filePath, newContent, 'utf-8');

  console.log(`✅ ${relativePath}`);
  return true;
}

async function migrateFile(fileInfo: FileInfo): Promise<'success' | 'failure' | 'skipped'> {
  const { path: filePath, type } = fileInfo;
  const relativePath = path.relative(getProjectRoot(), filePath);

  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  // if (ENGINE.isUpdateToDateData(data)) {
  //   console.log(`ℹ️  ${relativePath}: Already up to date, skipping`);
  //   // return 'skipped';
  // }

  try {
    if (type === 'scene') {
      return await migrateSceneFile(data, filePath, relativePath) ? 'success' : 'failure';
    } else if (type === 'prefab') {
      return await migratePrefabFile(data, filePath, relativePath) ? 'success' : 'failure';
    } else if (type === 'material') {
      return await migrateMaterialFile(data, filePath, relativePath) ? 'success' : 'failure';
    }
  } catch (error) {
    console.error(`❌ ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return 'failure';
  } finally {
    console.log('');
  }
  return 'skipped';
}

interface MigrationResult {
  successCount: number;
  failCount: number;
}

async function runMigrationPass(
  sceneFiles: FileInfo[],
  prefabFiles: FileInfo[],
  materialFiles: FileInfo[],
  passNumber: number
): Promise<MigrationResult> {
  let successCount = 0;
  let failCount = 0;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Migration Pass ${passNumber}`);
  console.log(`${'='.repeat(60)}\n`);

  // Migrate scenes first (must be done before prefabs to ensure engine can load new prefab data)
  if (sceneFiles.length > 0) {
    console.log('🌍 Migrating scenes...\n');
    for (const fileInfo of sceneFiles) {
      const success = await migrateFile(fileInfo);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
  }

  // Then migrate prefabs
  if (prefabFiles.length > 0) {
    console.log('\n📦 Migrating prefabs...\n');
    for (const fileInfo of prefabFiles) {
      const success = await migrateFile(fileInfo);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
  }

  // Finally migrate materials
  if (materialFiles.length > 0) {
    console.log('\n🎨 Migrating materials...\n');
    for (const fileInfo of materialFiles) {
      const success = await migrateFile(fileInfo);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
  }

  return { successCount, failCount };
}

async function main() {
  // Game classes are registered via the top-level import of dist/src/game.js
  // Make sure to run `pnpm build` first!

  const projectRoot = getProjectRoot();
  const assetsFolder = path.join(projectRoot, 'assets');
  console.log(`📁 Scanning for scene and prefab files in: ${assetsFolder}\n`);

  // Find all scene and prefab files in the assets folder
  const files = findScenesAndPrefabs(assetsFolder);

  if (files.length === 0) {
    console.log('⚠️  No scene or prefab files found.');
    return;
  }

  const prefabFiles = files.filter(f => f.type === 'prefab');
  const sceneFiles = files.filter(f => f.type === 'scene');
  const materialFiles = files.filter(f => f.type === 'material');
  console.log(`Found ${files.length} files to migrate:`);
  console.log(`  - ${sceneFiles.length} scene file(s)`);
  console.log(`  - ${prefabFiles.length} prefab file(s)`);
  console.log(`  - ${materialFiles.length} material file(s)`);

  // Run migration twice to ensure prefab instances in scenes are saved properly
  // (prefab instances are only saved correctly when both prefab and scene data are the same version)
  const pass1 = await runMigrationPass(sceneFiles, prefabFiles, materialFiles, 1);
  const pass2 = await runMigrationPass(sceneFiles, prefabFiles, materialFiles, 2);

  const totalSuccess = pass1.successCount + pass2.successCount;
  const totalFail = pass1.failCount + pass2.failCount;

  console.log(`\n${'='.repeat(60)}`);
  console.log('Migration Summary:');
  console.log(`  Total files per pass: ${files.length}`);
  console.log(`  Pass 1 - Successful: ${pass1.successCount}, Failed: ${pass1.failCount}`);
  console.log(`  Pass 2 - Successful: ${pass2.successCount}, Failed: ${pass2.failCount}`);
  console.log(`  Total - Successful: ${totalSuccess}, Failed: ${totalFail}`);
  console.log(`${'='.repeat(60)}`);

  if (totalFail > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
