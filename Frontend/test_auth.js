import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = import.meta.env ? import.meta.env.VITE_API_URL : process.env.VITE_API_URL || 'http://localhost:5000/api';

async function check() {
  try {
    console.log(`Testing reachability of ${url}/auth/me...`);
    const res = await axios.get(`${url}/auth/me`, { validateStatus: false });
    console.log("Status:", res.status);
    console.log("Response:", res.data);
    if (res.status === 401 || res.status === 200 || res.status === 404) {
      console.log("SUCCESS: Endpoint is reachable.");
    } else {
      console.error("FAIL: Unexpected status:", res.status);
      process.exit(1);
    }
  } catch (error) {
    console.error("FAIL: Cannot reach endpoint:", error.message);
    process.exit(1);
  }
}
check();
