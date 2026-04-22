import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";

export type AuthRole = "patient" | "hospital";

export type PublicAuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  createdAt: string;
};

type StoredAuthUser = PublicAuthUser & {
  passwordSalt: string;
  passwordHash: string;
};

type SignInResult = {
  token: string;
  user: PublicAuthUser;
};

const usersByEmail = new Map<string, StoredAuthUser>();
const usersById = new Map<string, StoredAuthUser>();

const JWT_SECRET = process.env.JWT_SECRET ?? "blockmedshare-dev-jwt-secret";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt: string): string {
  return createHmac("sha256", salt).update(password).digest("hex");
}

function toPublicUser(user: StoredAuthUser): PublicAuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function signUpUser(input: {
  name: string;
  email: string;
  password: string;
  role: AuthRole;
}): SignInResult {
  const email = normalizeEmail(input.email);
  if (usersByEmail.has(email)) {
    throw new Error("User with this email already exists");
  }

  const salt = randomBytes(16).toString("hex");
  const user: StoredAuthUser = {
    id: `usr_${randomBytes(8).toString("hex")}`,
    name: input.name.trim(),
    email,
    role: input.role,
    createdAt: new Date().toISOString(),
    passwordSalt: salt,
    passwordHash: hashPassword(input.password, salt),
  };

  usersByEmail.set(email, user);
  usersById.set(user.id, user);

  return {
    token: createAuthToken(user),
    user: toPublicUser(user),
  };
}

export function signInUser(input: {
  email: string;
  password: string;
  role: AuthRole;
}): SignInResult {
  const email = normalizeEmail(input.email);
  const user = usersByEmail.get(email);

  if (!user || user.role !== input.role) {
    throw new Error("Invalid credentials");
  }

  const expected = Buffer.from(user.passwordHash, "hex");
  const actual = Buffer.from(
    hashPassword(input.password, user.passwordSalt),
    "hex",
  );

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid credentials");
  }

  return {
    token: createAuthToken(user),
    user: toPublicUser(user),
  };
}

export function getUserFromToken(token: string): PublicAuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: string };
    if (!decoded.sub) {
      return null;
    }
    const user = usersById.get(decoded.sub);
    return user ? toPublicUser(user) : null;
  } catch {
    return null;
  }
}

function createAuthToken(user: StoredAuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}
