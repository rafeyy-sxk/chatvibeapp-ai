import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth/tokens";
import { hashPassword, verifyPassword } from "@/lib/security/password";

describe("Auth utilities", () => {
  it("round-trips access tokens", () => {
    const token = generateAccessToken({ sub: "user-1", username: "tester" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.username).toBe("tester");
  });

  it("round-trips refresh tokens", () => {
    const token = generateRefreshToken({ sub: "user-2" });
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe("user-2");
  });

  it("hashes and verifies passwords securely", async () => {
    const password = "TestPass!234";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });
});

