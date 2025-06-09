#!/usr/bin/env node

/**
 * SettingManager 使用示例
 * 展示如何使用 SettingManager 来管理配置
 */

import SettingManager from '../src/SettingManager.js';

console.log('=== SettingManager 使用示例 ===\n');

try {
  // 获取单例实例
  const settings = SettingManager.getInstance();
  
  console.log('1. 读取现有配置:');
  console.log('   xiaozhi.endpoint:', settings.get('xiaozhi.endpoint'));
  console.log('   mcpServers.amap-maps.command:', settings.get('mcpServers.amap-maps.command'));
  console.log();
  
  console.log('2. 检查配置是否存在:');
  console.log('   xiaozhi.endpoint exists:', settings.has('xiaozhi.endpoint'));
  console.log('   nonexistent.key exists:', settings.has('nonexistent.key'));
  console.log();
  
  console.log('3. 更新配置 (会自动保存到文件):');
  // 备份原始值
  const originalEndpoint = settings.get('xiaozhi.endpoint');
  
  // 更新配置
  settings.set('xiaozhi.endpoint', 'wss://test.example.com/mcp');
  console.log('   Updated xiaozhi.endpoint to:', settings.get('xiaozhi.endpoint'));
  
  // 添加新的配置项
  settings.set('test.newConfig', 'test value');
  console.log('   Added test.newConfig:', settings.get('test.newConfig'));
  console.log();
  
  console.log('4. 恢复原始配置:');
  // 恢复原始值
  settings.set('xiaozhi.endpoint', originalEndpoint);
  console.log('   Restored xiaozhi.endpoint to:', settings.get('xiaozhi.endpoint'));
  
  // 删除测试配置
  settings.delete('test.newConfig');
  console.log('   Deleted test.newConfig, exists:', settings.has('test.newConfig'));
  console.log();
  
  console.log('5. 获取所有配置:');
  const allSettings = settings.getAll();
  console.log('   All settings keys:', Object.keys(allSettings));
  console.log();
  
  console.log('✅ SettingManager 示例运行完成！');
  
} catch (error) {
  console.error('❌ 错误:', error.message);
  process.exit(1);
}
