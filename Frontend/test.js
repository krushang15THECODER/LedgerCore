async function test() {
  try {
    const res = await fetch("http://localhost:5000/api/auth/me");
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
    if (res.status === 401 || res.status === 200 || res.status === 404) {
      console.log("SUCCESS: Endpoint reachable!");
      process.exit(0);
    } else {
      console.log("FAIL: Unexpected status.");
      process.exit(1);
    }
  } catch(e) {
    console.error("FAIL:", e.message);
    process.exit(1);
  }
}
test();
