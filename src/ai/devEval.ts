import { interpret } from "./agent";

// AI Agent Smoke Tests - Drop-in evaluation harness
export async function runAgentSmokeTests() {
  console.log('🤖 Running AI Agent Smoke Tests...\n');
  
  const tests = [
    // Rotation commands
    "rotate 45",
    "rotate clockwise", 
    "rotate the rectangle 90 degrees",
    "turn left",
    
    // Movement commands  
    "move to center",
    "move to 100 200",
    "move the blue circle to center",
    
    // Resize commands
    "make it twice as big",
    "resize to 200x300", 
    "make the rectangle bigger",
    "shrink it by half",
    
    // Creation commands
    "create a red circle",
    "make a 200x300 rectangle", 
    "create text 'Hello World'",
    "add a blue circle",
    
    // Layout commands
    "arrange in a horizontal row",
    "grid 3x2",
    "create a 2x3 grid",
    
    // Complex commands
    "create a login form",
    "make a navigation bar",
    
    // Edge cases
    "rotate", // missing target
    "move", // missing destination
    "create", // missing shape type
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const start = performance.now();
      const res = await interpret(test);
      const duration = Math.round(performance.now() - start);
      
      const success = res && typeof res === 'object' && (res.ok || res.error);
      const status = res?.ok ? '✅ SUCCESS' : res?.error ? '⚠️  ERROR' : '❌ FAILED';
      
      console.log(`[${status}] "${test}" (${duration}ms)`);
      if (res?.error) console.log(`    → ${res.error}`);
      if (res?.tool_calls) console.log(`    → ${res.tool_calls.length} tool calls`);
      
      results.push({ test, success, duration, result: res });
      
    } catch (error) {
      console.log(`[❌ CRASH] "${test}"`);
      console.log(`    → ${error}`);
      results.push({ test, success: false, duration: 0, error });
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / total;
  
  console.log(`\n📊 Test Summary:`);
  console.log(`   Success Rate: ${successful}/${total} (${Math.round(successful/total*100)}%)`);
  console.log(`   Average Duration: ${Math.round(avgDuration)}ms`);
  console.log(`   Rule-based Parser: ${successful > total * 0.7 ? '🚀 Excellent' : successful > total * 0.5 ? '✅ Good' : '⚠️  Needs work'}`);
  
  return results;
}

// Quick single command test
export async function testCommand(command: string) {
  console.log(`🧪 Testing: "${command}"`);
  const start = performance.now();
  const result = await interpret(command);
  const duration = Math.round(performance.now() - start);
  
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log(`📤 Result:`, result);
  
  return result;
}

// Performance benchmark
export async function benchmarkAgent(iterations = 100) {
  console.log(`⚡ Running performance benchmark (${iterations} iterations)...`);
  
  const commands = [
    "rotate 45",
    "move to center", 
    "create a red circle",
    "make it twice as big",
    "grid 2x2"
  ];
  
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const command = commands[i % commands.length];
    const start = performance.now();
    await interpret(command);
    const duration = performance.now() - start;
    times.push(duration);
  }
  
  times.sort((a, b) => a - b);
  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  
  console.log(`📊 Performance Results (${iterations} commands):`);
  console.log(`   Average: ${avg.toFixed(1)}ms`);
  console.log(`   P50: ${p50.toFixed(1)}ms`);
  console.log(`   P95: ${p95.toFixed(1)}ms`);  
  console.log(`   P99: ${p99.toFixed(1)}ms`);
  console.log(`   Target: <10ms for rule-based commands`);
  
  return { avg, p50, p95, p99, times };
}
