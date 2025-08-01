/**
 * 无限循环测试工具
 * 用于检测 Zustand store 选择器是否会导致无限循环
 */

import { useWebSocketStore } from "../stores/websocket";

// 模拟不使用 useShallow 的选择器（会导致无限循环）
const badSelector = () =>
  useWebSocketStore.getState() && 
  useWebSocketStore((state) => ({
    setConnected: state.setConnected,
    setConfig: state.setConfig,
    setStatus: state.setStatus,
  }));

// 测试选择器稳定性
export function testSelectorStability() {
  console.log("🧪 开始测试选择器稳定性...");
  
  const store = useWebSocketStore.getState();
  
  // 测试多次调用是否返回相同引用
  const call1 = useWebSocketStore((state) => ({
    setConnected: state.setConnected,
    setConfig: state.setConfig,
  }));
  
  const call2 = useWebSocketStore((state) => ({
    setConnected: state.setConnected,
    setConfig: state.setConfig,
  }));
  
  console.log("第一次调用结果:", call1);
  console.log("第二次调用结果:", call2);
  console.log("引用是否相同:", call1 === call2);
  
  if (call1 === call2) {
    console.log("✅ 选择器稳定性测试通过");
  } else {
    console.log("❌ 选择器稳定性测试失败 - 可能导致无限循环");
  }
}

// 测试渲染性能
export function testRenderPerformance() {
  console.log("🚀 开始测试渲染性能...");
  
  const startTime = performance.now();
  let renderCount = 0;
  
  // 模拟多次渲染
  for (let i = 0; i < 1000; i++) {
    const state = useWebSocketStore.getState();
    renderCount++;
  }
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`渲染次数: ${renderCount}`);
  console.log(`总耗时: ${duration.toFixed(2)}ms`);
  console.log(`平均耗时: ${(duration / renderCount).toFixed(4)}ms/次`);
  
  if (duration < 100) {
    console.log("✅ 渲染性能测试通过");
  } else {
    console.log("⚠️ 渲染性能可能需要优化");
  }
}

// 检查 store 状态
export function checkStoreState() {
  console.log("📊 检查 Store 状态...");
  
  const state = useWebSocketStore.getState();
  
  console.log("当前状态:", {
    connected: state.connected,
    wsUrl: state.wsUrl,
    hasConfig: !!state.config,
    hasStatus: !!state.status,
  });
  
  // 检查 actions 是否存在
  const actions = [
    'setConnected',
    'setConfig', 
    'setStatus',
    'setRestartStatus',
    'setWsUrl',
    'updateFromWebSocket',
    'reset'
  ];
  
  const missingActions = actions.filter(action => typeof state[action] !== 'function');
  
  if (missingActions.length === 0) {
    console.log("✅ 所有 actions 都存在");
  } else {
    console.log("❌ 缺少 actions:", missingActions);
  }
}

// 运行所有测试
export function runAllTests() {
  console.log("🔍 开始运行所有测试...");
  console.log("=".repeat(50));
  
  try {
    testSelectorStability();
    console.log("-".repeat(30));
    
    testRenderPerformance();
    console.log("-".repeat(30));
    
    checkStoreState();
    console.log("-".repeat(30));
    
    console.log("✅ 所有测试完成");
  } catch (error) {
    console.error("❌ 测试过程中出现错误:", error);
  }
  
  console.log("=".repeat(50));
}

// 在浏览器控制台中可以调用的全局函数
if (typeof window !== 'undefined') {
  (window as any).testZustandStore = {
    runAllTests,
    testSelectorStability,
    testRenderPerformance,
    checkStoreState,
  };
  
  console.log("🛠️ Zustand Store 测试工具已加载");
  console.log("在控制台中运行 window.testZustandStore.runAllTests() 来执行所有测试");
}
