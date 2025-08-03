#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🌱 Starting database seeding...');

// Run the seeding script with ts-node
const seedProcess = spawn('npx', [
  'ts-node',
  '-r', 'tsconfig-paths/register',
  path.join(__dirname, '../src/database/seeds/seedData.ts')
], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..')
});

seedProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Seeding completed successfully!');
  } else {
    console.error('❌ Seeding failed with code:', code);
    process.exit(code);
  }
});

seedProcess.on('error', (error) => {
  console.error('❌ Failed to start seeding process:', error);
  process.exit(1);
}); 