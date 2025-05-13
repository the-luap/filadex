import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "./shared/schema.js";

// Get database connection string from environment variables
// Default to PostgreSQL connection using docker-compose variables if not set
const DATABASE_URL = process.env.DATABASE_URL ||
  `postgres://${process.env.POSTGRES_USER || 'filadex'}:${process.env.POSTGRES_PASSWORD || 'filadex'}@postgres:5432/${process.env.POSTGRES_DB || 'filadex'}`;

console.log("Connecting to database with URL:", DATABASE_URL.replace(/:[^:]*@/, ':****@')); // Log URL with password masked

export const pool = new Pool({
  connectionString: DATABASE_URL,
  // Add connection retry logic
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to the database');
    client.release();
    return true;
  } catch (err) {
    console.error('Error connecting to the database:', err.stack);
    return false;
  }
};

export const db = drizzle(pool, { schema });
const { users, filaments } = schema;
import { eq } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

// Test database connection
testConnection()
  .then(connected => {
    if (connected) {
      console.log("Database connection successful");
    } else {
      console.error("Failed to connect to the database");
    }
  })
  .catch(err => {
    console.error("Error testing database connection:", err);
  });

// Middleware
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      // If JSON parsing fails, store the raw body for manual parsing later
      req.rawBody = buf.toString();
    }
  }
}));
app.use(cookieParser());

// Trust proxy for reverse proxies like Traefik
app.set('trust proxy', true);

// Handle reverse proxy headers
app.use((req, res, next) => {
  // Get protocol from X-Forwarded-Proto header or default to http
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;

  // Set secure cookies if using https
  if (protocol === 'https') {
    res.cookie('secure', true, { secure: true });
  }

  // Log headers for debugging
  console.log('Request headers:', {
    host: req.headers.host,
    'x-forwarded-for': req.headers['x-forwarded-for'],
    'x-forwarded-proto': req.headers['x-forwarded-proto'],
    'x-forwarded-host': req.headers['x-forwarded-host']
  });

  next();
});

app.use(express.static(path.join(__dirname, "public")));

// Get admin password from environment variable or use default
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
console.log(`Using admin password from ${process.env.ADMIN_PASSWORD ? 'environment variable' : 'default'}`);

// Set up logging level from environment variable
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_LEVEL = process.env.LOG_LEVEL ?
  (LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] !== undefined ?
    LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : LOG_LEVELS.INFO)
  : LOG_LEVELS.INFO;

console.log(`Log level set to: ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === LOG_LEVEL)}`);

// Custom logger function that respects log level
const logger = {
  error: (...args) => {
    if (LOG_LEVEL >= LOG_LEVELS.ERROR) console.error(...args);
  },
  warn: (...args) => {
    if (LOG_LEVEL >= LOG_LEVELS.WARN) console.warn(...args);
  },
  info: (...args) => {
    if (LOG_LEVEL >= LOG_LEVELS.INFO) console.log(...args);
  },
  debug: (...args) => {
    if (LOG_LEVEL >= LOG_LEVELS.DEBUG) console.log('[DEBUG]', ...args);
  }
};

// Function to hash a password
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Function to compare a password with a hash
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Generate a unique session ID for this server instance
// This will be used to invalidate tokens when the server restarts
const SERVER_SESSION_ID = Date.now().toString();

// Initialize users in the database
const initializeUsers = async () => {
  try {
    // Check if admin user exists
    const existingUsers = await db.select().from(users);

    if (existingUsers.length === 0) {
      logger.info("No users found in database. Creating default admin user...");

      // Create admin user
      const hashedPassword = await hashPassword(DEFAULT_ADMIN_PASSWORD);

      await db.insert(users).values({
        username: "admin",
        password: hashedPassword,
        isAdmin: true,
        forceChangePassword: true
      });

      // Create regular user
      await db.insert(users).values({
        username: "user",
        password: await hashPassword("password"),
        isAdmin: false,
        forceChangePassword: false
      });

      logger.info("Default users created successfully");
    } else {
      logger.info(`Found ${existingUsers.length} existing users in database`);
    }
  } catch (error) {
    logger.error("Error initializing users:", error);
  }
};

// Initialize users
initializeUsers().catch(err => {
  logger.error("Error initializing users:", err);
});

// Authentication API routes
app.post("/api/auth/login", async (req, res) => {
  try {
    // Handle the double-stringified JSON issue
    let data = req.body;

    // If body parsing failed and we have a raw body, try to parse it manually
    if (Object.keys(data).length === 0 && req.rawBody) {
      try {
        // Try to parse the raw body
        data = JSON.parse(req.rawBody);
        logger.debug("Parsed from raw body:", data);
      } catch (e) {
        logger.error("Error parsing raw body:", e);

        // Try to handle double-stringified JSON
        try {
          // Remove any extra quotes at the beginning and end
          const cleanedBody = req.rawBody.replace(/^"+|"+$/g, '');
          // Replace escaped quotes with regular quotes
          const unescapedBody = cleanedBody.replace(/\\"/g, '"');
          data = JSON.parse(unescapedBody);
          logger.debug("Parsed after cleaning:", data);
        } catch (e2) {
          logger.error("Error parsing cleaned body:", e2);

          // Try one more approach - sometimes the body is double-stringified with extra quotes
          try {
            // This handles cases where the body is like: ""{\"username\":\"test\",\"password\":\"test\"}"
            const match = req.rawBody.match(/^"(.*)"$/);
            if (match) {
              const innerJson = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              data = JSON.parse(innerJson);
              logger.debug("Parsed after regex extraction:", data);
            } else {
              return res.status(400).json({ message: "Invalid request format" });
            }
          } catch (e3) {
            logger.error("All parsing attempts failed:", e3);
            return res.status(400).json({ message: "Invalid request format" });
          }
        }
      }
    }

    // Also handle case where body might be a string
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing string body:", e);

        // Try to handle double-stringified JSON
        try {
          // Remove any extra quotes at the beginning and end
          const cleanedBody = data.replace(/^"+|"+$/g, '');
          // Replace escaped quotes with regular quotes
          const unescapedBody = cleanedBody.replace(/\\"/g, '"');
          data = JSON.parse(unescapedBody);
        } catch (e2) {
          logger.error("Error parsing cleaned string body:", e2);

          // Try one more approach - sometimes the body is double-stringified with extra quotes
          try {
            // This handles cases where the body is like: ""{\"username\":\"test\",\"password\":\"test\"}"
            const match = data.match(/^"(.*)"$/);
            if (match) {
              const innerJson = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              data = JSON.parse(innerJson);
            } else {
              return res.status(400).json({ message: "Invalid request format" });
            }
          } catch (e3) {
            logger.error("All parsing attempts failed:", e3);
            return res.status(400).json({ message: "Invalid request format" });
          }
        }
      }
    }

    // Log the request body for debugging (without sensitive data)
    const { password: pwd, ...logData } = data;
    logger.debug("Login request body:", logData);

    // Extract username and password
    const { username, password } = data;

    if (!username || !password) {
      logger.error("Missing username or password");
      return res.status(400).json({ message: "Username and password are required" });
    }

    // Find user by username from database
    const userResults = await db.select().from(users).where(eq(users.username, username));

    if (userResults.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const user = userResults[0];

    // Verify password using bcrypt
    const passwordMatch = await comparePassword(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Update last login time
    await db.update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Get protocol from X-Forwarded-Proto header or default to http
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;

    // Set authentication cookie with secure flag if using https
    // Include the server session ID to invalidate tokens on server restart
    res.cookie("auth", `${user.id}:${SERVER_SESSION_ID}`, {
      httpOnly: true,
      secure: protocol === 'https',
      sameSite: 'lax', // Allow cookies to be sent in cross-site requests
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Return user data without password
    const { password: _, ...userData } = user;

    // Make sure forceChangePassword is included in the response
    const forceChangePassword = user.forceChangePassword === true;

    logger.info("Login successful for user:", userData.username);
    logger.debug("User details:", userData);
    logger.debug("Force change password:", forceChangePassword);

    return res.status(200).json({
      user: userData,
      forceChangePassword: forceChangePassword
    });
  } catch (error) {
    logger.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("auth");
  return res.status(200).json({ message: "Logged out successfully" });
});

// Change password endpoint
app.post("/api/auth/change-password", async (req, res) => {
  try {
    const authCookie = req.cookies.auth;

    if (!authCookie) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Parse the auth cookie which now includes the server session ID
    const [userIdStr, sessionId] = authCookie.split(':');

    // Verify that the session ID matches the current server instance
    if (sessionId !== SERVER_SESSION_ID) {
      // Session is from a previous server instance, invalidate it
      res.clearCookie("auth");
      return res.status(401).json({ message: "Session expired, please login again" });
    }

    const userId = parseInt(userIdStr);

    // Get user from database
    const userResults = await db.select().from(users).where(eq(users.id, userId));

    if (userResults.length === 0) {
      return res.status(401).json({ message: "Invalid authentication" });
    }

    const user = userResults[0];

    // Parse request body if needed
    let data = req.body;

    // Handle case where body might be a string
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);

        // Try to handle double-stringified JSON
        try {
          // Remove any extra quotes at the beginning and end
          const cleanedBody = data.replace(/^"+|"+$/g, '');
          // Replace escaped quotes with regular quotes
          const unescapedBody = cleanedBody.replace(/\\"/g, '"');
          data = JSON.parse(unescapedBody);
        } catch (e2) {
          logger.error("Error parsing cleaned body:", e2);

          // Try one more approach - sometimes the body is double-stringified with extra quotes
          try {
            // This handles cases where the body is like: ""{\"username\":\"test\",\"password\":\"test\"}"
            const match = data.match(/^"(.*)"$/);
            if (match) {
              const innerJson = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              data = JSON.parse(innerJson);
            } else {
              return res.status(400).json({ message: "Invalid request format" });
            }
          } catch (e3) {
            logger.error("All parsing attempts failed:", e3);
            return res.status(400).json({ message: "Invalid request format" });
          }
        }
      }
    }

    // Log without sensitive data
    logger.debug("Change password request received for user ID:", userId);

    // Get current and new password from request
    const { currentPassword, newPassword } = data;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    // Verify current password using bcrypt
    const passwordMatch = await comparePassword(currentPassword, user.password);

    if (!passwordMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the user in the database
    await db.update(users)
      .set({
        password: hashedPassword,
        forceChangePassword: user.forceChangePassword ? false : user.forceChangePassword
      })
      .where(eq(users.id, user.id));

    logger.info("Password changed for user:", user.username);

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    logger.error("Change password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const authCookie = req.cookies.auth;

    if (!authCookie) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Parse the auth cookie which now includes the server session ID
    const [userIdStr, sessionId] = authCookie.split(':');

    // Verify that the session ID matches the current server instance
    if (sessionId !== SERVER_SESSION_ID) {
      // Session is from a previous server instance, invalidate it
      res.clearCookie("auth");
      return res.status(401).json({ message: "Session expired, please login again" });
    }

    const userId = parseInt(userIdStr);

    // Get user from database
    const userResults = await db.select().from(users).where(eq(users.id, userId));

    if (userResults.length === 0) {
      return res.status(401).json({ message: "Invalid authentication" });
    }

    const user = userResults[0];

    // Return user data without password
    const { password, ...userData } = user;

    return res.status(200).json(userData);
  } catch (error) {
    logger.error("Error in /api/auth/me endpoint:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// User management endpoints
app.get("/api/users", async (req, res) => {
  try {
    const authCookie = req.cookies.auth;
    if (!authCookie) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Parse the auth cookie
    const [userIdStr, sessionId] = authCookie.split(':');

    // Verify session
    if (sessionId !== SERVER_SESSION_ID) {
      res.clearCookie("auth");
      return res.status(401).json({ message: "Session expired, please login again" });
    }

    const userId = parseInt(userIdStr);

    // Get current user from database
    const currentUserResults = await db.select().from(users).where(eq(users.id, userId));

    if (currentUserResults.length === 0 || !currentUserResults[0].isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Get all users from database
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      forceChangePassword: users.forceChangePassword,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt
    }).from(users);

    return res.status(200).json(allUsers);
  } catch (error) {
    logger.error("Error fetching users:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const authCookie = req.cookies.auth;
    if (!authCookie) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Parse the auth cookie
    const [userIdStr, sessionId] = authCookie.split(':');

    // Verify session
    if (sessionId !== SERVER_SESSION_ID) {
      res.clearCookie("auth");
      return res.status(401).json({ message: "Session expired, please login again" });
    }

    const userId = parseInt(userIdStr);

    // Get current user from database
    const currentUserResults = await db.select().from(users).where(eq(users.id, userId));

    if (currentUserResults.length === 0 || !currentUserResults[0].isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Parse request body
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);

        // Try to handle double-stringified JSON
        try {
          // Remove any extra quotes at the beginning and end
          const cleanedBody = data.replace(/^"+|"+$/g, '');
          // Replace escaped quotes with regular quotes
          const unescapedBody = cleanedBody.replace(/\\"/g, '"');
          data = JSON.parse(unescapedBody);
        } catch (e2) {
          logger.error("Error parsing cleaned body:", e2);

          // Try one more approach - sometimes the body is double-stringified with extra quotes
          try {
            // This handles cases where the body is like: ""{\"username\":\"test\",\"password\":\"test\"}"
            const match = data.match(/^"(.*)"$/);
            if (match) {
              const innerJson = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              data = JSON.parse(innerJson);
            } else {
              return res.status(400).json({ message: "Invalid request format" });
            }
          } catch (e3) {
            logger.error("All parsing attempts failed:", e3);
            return res.status(400).json({ message: "Invalid request format" });
          }
        }
      }
    }

    // Validate required fields
    const { username, password, isAdmin = false, forceChangePassword = true } = data;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    // Check if username already exists in database
    const existingUser = await db.select().from(users).where(eq(users.username, username));

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create new user in database
    const newUser = await db.insert(users).values({
      username,
      password: hashedPassword,
      isAdmin,
      forceChangePassword
    }).returning({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      forceChangePassword: users.forceChangePassword,
      createdAt: users.createdAt
    });

    logger.info("New user created:", username);

    // Return the created user
    return res.status(201).json(newUser[0]);
  } catch (error) {
    logger.error("Error creating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const authCookie = req.cookies.auth;
    if (!authCookie) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Parse the auth cookie
    const [userIdStr, sessionId] = authCookie.split(':');

    // Verify session
    if (sessionId !== SERVER_SESSION_ID) {
      res.clearCookie("auth");
      return res.status(401).json({ message: "Session expired, please login again" });
    }

    const userId = parseInt(userIdStr);

    // Get current user from database
    const currentUserResults = await db.select().from(users).where(eq(users.id, userId));

    if (currentUserResults.length === 0 || !currentUserResults[0].isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Get user ID from URL
    const targetUserId = parseInt(req.params.id);

    // Check if target user exists in database
    const targetUserResults = await db.select().from(users).where(eq(users.id, targetUserId));

    if (targetUserResults.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetUser = targetUserResults[0];

    // Parse request body
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);

        // Try to handle double-stringified JSON
        try {
          // Remove any extra quotes at the beginning and end
          const cleanedBody = data.replace(/^"+|"+$/g, '');
          // Replace escaped quotes with regular quotes
          const unescapedBody = cleanedBody.replace(/\\"/g, '"');
          data = JSON.parse(unescapedBody);
        } catch (e2) {
          logger.error("Error parsing cleaned body:", e2);

          // Try one more approach - sometimes the body is double-stringified with extra quotes
          try {
            // This handles cases where the body is like: ""{\"username\":\"test\",\"password\":\"test\"}"
            const match = data.match(/^"(.*)"$/);
            if (match) {
              const innerJson = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              data = JSON.parse(innerJson);
            } else {
              return res.status(400).json({ message: "Invalid request format" });
            }
          } catch (e3) {
            logger.error("All parsing attempts failed:", e3);
            return res.status(400).json({ message: "Invalid request format" });
          }
        }
      }
    }

    // Prepare update data
    const updateData = {};

    if (data.username !== undefined) {
      // Check if new username already exists (if changed)
      if (data.username !== targetUser.username) {
        const existingUser = await db.select().from(users)
          .where(eq(users.username, data.username));

        if (existingUser.length > 0) {
          return res.status(400).json({ message: "Username already exists" });
        }

        updateData.username = data.username;
      }
    }

    if (data.password) {
      updateData.password = await hashPassword(data.password);
    }

    if (data.isAdmin !== undefined) {
      updateData.isAdmin = data.isAdmin;
    }

    if (data.forceChangePassword !== undefined) {
      updateData.forceChangePassword = data.forceChangePassword;
    }

    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      // Update user in database
      const updatedUser = await db.update(users)
        .set(updateData)
        .where(eq(users.id, targetUserId))
        .returning({
          id: users.id,
          username: users.username,
          isAdmin: users.isAdmin,
          forceChangePassword: users.forceChangePassword,
          lastLogin: users.lastLogin,
          createdAt: users.createdAt
        });

      logger.info("User updated:", updatedUser[0].username);

      return res.status(200).json(updatedUser[0]);
    } else {
      // No changes, return current user data
      const { password, ...userData } = targetUser;
      logger.info("No changes to user:", userData.username);
      return res.status(200).json(userData);
    }
  } catch (error) {
    logger.error("Error updating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const authCookie = req.cookies.auth;
    if (!authCookie) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Parse the auth cookie
    const [userIdStr, sessionId] = authCookie.split(':');

    // Verify session
    if (sessionId !== SERVER_SESSION_ID) {
      res.clearCookie("auth");
      return res.status(401).json({ message: "Session expired, please login again" });
    }

    const userId = parseInt(userIdStr);

    // Get current user from database
    const currentUserResults = await db.select().from(users).where(eq(users.id, userId));

    if (currentUserResults.length === 0 || !currentUserResults[0].isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Get user ID from URL
    const targetUserId = parseInt(req.params.id);

    // Don't allow deleting yourself
    if (targetUserId === userId) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    // Check if target user exists
    const targetUserResults = await db.select().from(users).where(eq(users.id, targetUserId));

    if (targetUserResults.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get username for logging before deletion
    const username = targetUserResults[0].username;

    // Delete user from database
    await db.delete(users).where(eq(users.id, targetUserId));

    logger.info("User deleted:", username);

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    logger.error("Error deleting user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// API routes for filaments
app.get("/api/filaments", async (_req, res) => {
  try {
    // Get filaments from database
    const filamentsData = await db.select().from(filaments);
    return res.status(200).json(filamentsData);
  } catch (error) {
    logger.error("Error fetching filaments:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/filaments", async (req, res) => {
  try {
    // Parse request body
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);
        return res.status(400).json({ message: "Invalid request format" });
      }
    }

    logger.info("Creating new filament with data:", data);

    // Validate required fields
    const {
      name,
      manufacturer,
      material,
      colorName,
      colorCode,
      diameter,
      totalWeight,
      remainingPercentage,
      purchaseDate,
      purchasePrice,
      printTemp,
      status,
      spoolType,
      storageLocation
    } = data;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Create new filament
    const newFilament = await db.insert(filaments).values({
      name,
      manufacturer,
      material,
      colorName,
      colorCode,
      diameter: parseFloat(diameter),
      totalWeight: parseFloat(totalWeight),
      remainingPercentage: parseInt(remainingPercentage),
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      printTemp,
      status,
      spoolType,
      storageLocation,
      dryerCount: data.dryerCount || 0,
      lastDryingDate: data.lastDryingDate ? new Date(data.lastDryingDate) : null,
      notes: data.notes || null,
      userId: req.user?.id || 1, // Default to user 1 if not authenticated
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    logger.info("New filament created:", name);
    return res.status(201).json(newFilament[0]);
  } catch (error) {
    logger.error("Error creating filament:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/api/filaments/:id", async (req, res) => {
  try {
    // Get filament ID from URL
    const filamentId = parseInt(req.params.id);

    // Parse request body
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);
        return res.status(400).json({ message: "Invalid request format" });
      }
    }

    logger.info(`Updating filament ${filamentId} with data:`, data);

    // Check if filament exists
    const filamentResults = await db.select().from(filaments).where(eq(filaments.id, filamentId));
    if (filamentResults.length === 0) {
      return res.status(404).json({ message: "Filament not found" });
    }

    // Check if user has access to this filament
    if (req.user && filamentResults[0].userId !== req.user.id) {
      // Check if filament is shared with user
      const sharedResults = await db.select()
        .from(userSharing)
        .where(and(
          eq(userSharing.filamentId, filamentId),
          eq(userSharing.userId, req.user.id)
        ));

      if (sharedResults.length === 0) {
        return res.status(403).json({ message: "You don't have permission to update this filament" });
      }
    }

    // Update filament
    const updateData = {
      ...data,
      updatedAt: new Date()
    };

    // Convert numeric fields
    if (updateData.diameter) updateData.diameter = parseFloat(updateData.diameter);
    if (updateData.totalWeight) updateData.totalWeight = parseFloat(updateData.totalWeight);
    if (updateData.remainingPercentage) updateData.remainingPercentage = parseInt(updateData.remainingPercentage);
    if (updateData.purchasePrice) updateData.purchasePrice = parseFloat(updateData.purchasePrice);
    if (updateData.dryerCount) updateData.dryerCount = parseInt(updateData.dryerCount);

    // Convert date fields
    if (updateData.purchaseDate) updateData.purchaseDate = new Date(updateData.purchaseDate);
    if (updateData.lastDryingDate) updateData.lastDryingDate = new Date(updateData.lastDryingDate);

    const updatedFilament = await db.update(filaments)
      .set(updateData)
      .where(eq(filaments.id, filamentId))
      .returning();

    logger.info(`Filament ${filamentId} updated successfully`);
    return res.status(200).json(updatedFilament[0]);
  } catch (error) {
    logger.error(`Error updating filament:`, error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Add PATCH endpoint for partial updates
app.patch("/api/filaments/:id", async (req, res) => {
  try {
    // Get filament ID from URL
    const filamentId = parseInt(req.params.id);

    // Parse request body
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);
        return res.status(400).json({ message: "Invalid request format" });
      }
    }

    logger.info(`Partially updating filament ${filamentId} with data:`, data);

    // Check if filament exists
    const filamentResults = await db.select().from(filaments).where(eq(filaments.id, filamentId));
    if (filamentResults.length === 0) {
      return res.status(404).json({ message: "Filament not found" });
    }

    // Check if user has access to this filament
    if (req.user && filamentResults[0].userId !== req.user.id) {
      // Check if filament is shared with user
      const sharedResults = await db.select()
        .from(userSharing)
        .where(and(
          eq(userSharing.filamentId, filamentId),
          eq(userSharing.userId, req.user.id)
        ));

      if (sharedResults.length === 0) {
        return res.status(403).json({ message: "You don't have permission to update this filament" });
      }
    }

    // Update filament
    const updateData = {
      ...data,
      updatedAt: new Date()
    };

    // Convert numeric fields
    if (updateData.diameter) updateData.diameter = parseFloat(updateData.diameter);
    if (updateData.totalWeight) updateData.totalWeight = parseFloat(updateData.totalWeight);
    if (updateData.remainingPercentage) updateData.remainingPercentage = parseInt(updateData.remainingPercentage);
    if (updateData.purchasePrice) updateData.purchasePrice = parseFloat(updateData.purchasePrice);
    if (updateData.dryerCount) updateData.dryerCount = parseInt(updateData.dryerCount);

    // Convert date fields
    if (updateData.purchaseDate) updateData.purchaseDate = new Date(updateData.purchaseDate);
    if (updateData.lastDryingDate) updateData.lastDryingDate = new Date(updateData.lastDryingDate);

    const updatedFilament = await db.update(filaments)
      .set(updateData)
      .where(eq(filaments.id, filamentId))
      .returning();

    logger.info(`Filament ${filamentId} partially updated successfully`);
    return res.status(200).json(updatedFilament[0]);
  } catch (error) {
    logger.error(`Error partially updating filament:`, error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/filaments/:id", async (req, res) => {
  try {
    // Get filament ID from URL
    const filamentId = parseInt(req.params.id);

    // Check if filament exists
    const filamentResults = await db.select().from(filaments).where(eq(filaments.id, filamentId));
    if (filamentResults.length === 0) {
      return res.status(404).json({ message: "Filament not found" });
    }

    // Check if user has access to this filament
    if (req.user && filamentResults[0].userId !== req.user.id) {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "You don't have permission to delete this filament" });
      }
    }

    // Delete filament
    await db.delete(filaments).where(eq(filaments.id, filamentId));

    logger.info(`Filament ${filamentId} deleted successfully`);
    return res.status(204).end();
  } catch (error) {
    logger.error(`Error deleting filament:`, error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// API routes for manufacturers
app.get("/api/manufacturers", async (_req, res) => {
  try {
    // Get manufacturers from database
    const manufacturersData = await db.select().from(schema.manufacturers);
    return res.status(200).json(manufacturersData);
  } catch (error) {
    logger.error("Error fetching manufacturers:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/manufacturers", async (req, res) => {
  try {
    // Parse request body
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);
        return res.status(400).json({ message: "Invalid request format" });
      }
    }

    // Check if this is a CSV import
    if (req.query.import === 'csv' && data.csvData) {
      logger.info("Processing CSV import for manufacturers");
      const results = {
        created: 0,
        duplicates: 0,
        errors: 0
      };

      // Parse CSV data
      const csvLines = data.csvData.split('\n');

      // Determine if there's a header and find the column index for the name
      let headerRow = csvLines[0].toLowerCase();
      let startIndex = 0;
      let nameColumnIndex = 0;

      // Check if header exists by looking for common header names
      if (headerRow.includes('name') || headerRow.includes('hersteller') || headerRow.includes('vendor')) {
        startIndex = 1;
        // If there are multiple columns, determine which one has the name
        if (headerRow.includes(',')) {
          const headers = headerRow.split(',');
          for (let i = 0; i < headers.length; i++) {
            if (headers[i].includes('name') || headers[i].includes('hersteller') || headers[i].includes('vendor')) {
              nameColumnIndex = i;
              break;
            }
          }
        }
      }

      logger.info(`CSV Import: Starting at line ${startIndex}, name column index: ${nameColumnIndex}`);

      // Get existing manufacturers once to improve performance
      const existingManufacturers = await db.select().from(schema.manufacturers);

      for (let i = startIndex; i < csvLines.length; i++) {
        const line = csvLines[i].trim();
        if (!line) continue;

        try {
          // Get the name from the appropriate column if there are multiple columns
          let name;
          if (line.includes(',')) {
            const columns = line.split(',');
            name = columns[nameColumnIndex].trim();
          } else {
            name = line.trim();
          }

          if (!name) {
            logger.warn(`Empty name at line ${i + 1}, skipping`);
            continue;
          }

          // Check if manufacturer already exists
          const existingManufacturer = existingManufacturers.find(m =>
            m.name.toLowerCase() === name.toLowerCase()
          );

          if (existingManufacturer) {
            logger.info(`Duplicate manufacturer: "${name}" at line ${i + 1}, already exists with ID ${existingManufacturer.id}`);
            results.duplicates++;
            continue;
          }

          // Create new manufacturer
          await db.insert(schema.manufacturers).values({
            name
          });

          logger.info(`Created manufacturer: "${name}" at line ${i + 1}`);
          results.created++;
        } catch (err) {
          logger.error(`Error importing manufacturer at line ${i + 1}:`, err);
          results.errors++;
        }
      }

      return res.status(201).json(results);
    }

    // Regular single manufacturer creation
    const { name } = data;
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Check if manufacturer already exists
    const existingManufacturer = await db.select().from(schema.manufacturers).where(eq(schema.manufacturers.name, name));
    if (existingManufacturer.length > 0) {
      return res.status(400).json({ message: "Manufacturer already exists" });
    }

    // Create new manufacturer
    const newManufacturer = await db.insert(schema.manufacturers).values({
      name
    }).returning();

    logger.info("New manufacturer created:", name);
    return res.status(201).json(newManufacturer[0]);
  } catch (error) {
    logger.error("Error creating manufacturer:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/manufacturers/:id", async (req, res) => {
  try {
    // Get manufacturer ID from URL
    const manufacturerId = parseInt(req.params.id);

    // Check if manufacturer exists
    const manufacturerResults = await db.select().from(schema.manufacturers).where(eq(schema.manufacturers.id, manufacturerId));
    if (manufacturerResults.length === 0) {
      return res.status(404).json({ message: "Manufacturer not found" });
    }

    // Delete manufacturer
    await db.delete(schema.manufacturers).where(eq(schema.manufacturers.id, manufacturerId));

    logger.info("Manufacturer deleted:", manufacturerResults[0].name);
    return res.status(204).end();
  } catch (error) {
    logger.error("Error deleting manufacturer:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// API routes for materials
app.get("/api/materials", async (_req, res) => {
  try {
    // Get materials from database
    const materialsData = await db.select().from(schema.materials);
    return res.status(200).json(materialsData);
  } catch (error) {
    logger.error("Error fetching materials:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/materials", async (req, res) => {
  try {
    // Parse request body
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);
        return res.status(400).json({ message: "Invalid request format" });
      }
    }

    // Check if this is a CSV import
    if (req.query.import === 'csv' && data.csvData) {
      logger.info("Processing CSV import for materials");
      const results = {
        created: 0,
        duplicates: 0,
        errors: 0
      };

      // Parse CSV data
      const csvLines = data.csvData.split('\n');

      // Determine if there's a header and find the column index for the name
      let headerRow = csvLines[0].toLowerCase();
      let startIndex = 0;
      let nameColumnIndex = 0;

      // Check if header exists by looking for common header names
      if (headerRow.includes('name') || headerRow.includes('material') || headerRow.includes('type')) {
        startIndex = 1;
        // If there are multiple columns, determine which one has the name
        if (headerRow.includes(',')) {
          const headers = headerRow.split(',');
          for (let i = 0; i < headers.length; i++) {
            if (headers[i].includes('name') || headers[i].includes('material') || headers[i].includes('type')) {
              nameColumnIndex = i;
              break;
            }
          }
        }
      }

      logger.info(`CSV Import Materials: Starting at line ${startIndex}, name column index: ${nameColumnIndex}`);

      // Get existing materials once to improve performance
      const existingMaterials = await db.select().from(schema.materials);

      for (let i = startIndex; i < csvLines.length; i++) {
        const line = csvLines[i].trim();
        if (!line) continue;

        try {
          // Get the name from the appropriate column if there are multiple columns
          let name;
          if (line.includes(',')) {
            const columns = line.split(',');
            name = columns[nameColumnIndex].trim();
          } else {
            name = line.trim();
          }

          if (!name) {
            logger.warn(`Empty material name at line ${i + 1}, skipping`);
            continue;
          }

          // Check if material already exists
          const existingMaterial = existingMaterials.find(m =>
            m.name.toLowerCase() === name.toLowerCase()
          );

          if (existingMaterial) {
            logger.info(`Duplicate material: "${name}" at line ${i + 1}, already exists with ID ${existingMaterial.id}`);
            results.duplicates++;
            continue;
          }

          // Create new material
          await db.insert(schema.materials).values({
            name
          });

          logger.info(`Created material: "${name}" at line ${i + 1}`);
          results.created++;
        } catch (err) {
          logger.error(`Error importing material at line ${i + 1}:`, err);
          results.errors++;
        }
      }

      return res.status(201).json(results);
    }

    // Regular single material creation
    const { name } = data;
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Check if material already exists
    const existingMaterial = await db.select().from(schema.materials).where(eq(schema.materials.name, name));
    if (existingMaterial.length > 0) {
      return res.status(400).json({ message: "Material already exists" });
    }

    // Create new material
    const newMaterial = await db.insert(schema.materials).values({
      name
    }).returning();

    logger.info("New material created:", name);
    return res.status(201).json(newMaterial[0]);
  } catch (error) {
    logger.error("Error creating material:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/materials/:id", async (req, res) => {
  try {
    // Get material ID from URL
    const materialId = parseInt(req.params.id);

    // Check if material exists
    const materialResults = await db.select().from(schema.materials).where(eq(schema.materials.id, materialId));
    if (materialResults.length === 0) {
      return res.status(404).json({ message: "Material not found" });
    }

    // Delete material
    await db.delete(schema.materials).where(eq(schema.materials.id, materialId));

    logger.info("Material deleted:", materialResults[0].name);
    return res.status(204).end();
  } catch (error) {
    logger.error("Error deleting material:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// API routes for colors
app.get("/api/colors", async (_req, res) => {
  try {
    // Get colors from database
    const colorsData = await db.select().from(schema.colors);
    return res.status(200).json(colorsData);
  } catch (error) {
    logger.error("Error fetching colors:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/colors", async (req, res) => {
  try {
    // Parse request body
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);
        return res.status(400).json({ message: "Invalid request format" });
      }
    }

    // Check if this is a CSV import
    if (req.query.import === 'csv' && data.csvData) {
      logger.info("Processing CSV import for colors");
      const results = {
        created: 0,
        duplicates: 0,
        errors: 0
      };

      // Parse CSV data
      const csvLines = data.csvData.split('\n');
      // Skip header row if present
      const startIndex = csvLines[0].toLowerCase().includes('name') || csvLines[0].toLowerCase().includes('brand') ? 1 : 0;

      // Get existing colors once to improve performance
      const existingColors = await db.select().from(schema.colors);

      for (let i = startIndex; i < csvLines.length; i++) {
        const line = csvLines[i].trim();
        if (!line) continue;

        try {
          // Manual parsing of CSV lines with or without quotes
          // Format: Brand,Color Name,Hex Code
          let name, code;

          const firstCommaIndex = line.indexOf(',');
          if (firstCommaIndex === -1) {
            results.errors++;
            logger.error(`No commas found in line ${i + 1}: ${line}`);
            continue;
          }

          const secondCommaIndex = line.indexOf(',', firstCommaIndex + 1);
          if (secondCommaIndex === -1) {
            // Simple format: Name,Code
            name = line.substring(0, firstCommaIndex).trim().replace(/"/g, '');
            code = line.substring(firstCommaIndex + 1).trim().replace(/"/g, '');
          } else {
            // Format: Brand,Color Name,Hex Code
            const brand = line.substring(0, firstCommaIndex).trim().replace(/"/g, '');
            const colorName = line.substring(firstCommaIndex + 1, secondCommaIndex).trim().replace(/"/g, '');
            name = `${colorName} (${brand})`;
            code = line.substring(secondCommaIndex + 1).trim().replace(/"/g, '');
          }

          // Check if all required values are present
          if (!name || !code) {
            results.errors++;
            logger.error(`Missing required values in line ${i + 1}: ${line}`);
            continue;
          }

          // Make sure code is a valid color code
          if (!code.startsWith('#')) {
            code = '#' + code;
          }

          // Check if color already exists - look for exact combination of name and code
          const exists = existingColors.some(c =>
            c.name.toLowerCase() === name.toLowerCase() &&
            c.code.toLowerCase() === code.toLowerCase()
          );

          if (exists) {
            results.duplicates++;
            continue;
          }

          // Create new color
          await db.insert(schema.colors).values({
            name,
            code
          });

          logger.info(`Created color: "${name}" with code "${code}" at line ${i + 1}`);
          results.created++;
        } catch (err) {
          logger.error(`Error importing color at line ${i + 1}:`, err);
          results.errors++;
        }
      }

      return res.status(201).json(results);
    }

    // Regular single color creation
    const { name, code } = data;
    if (!name || !code) {
      return res.status(400).json({ message: "Name and code are required" });
    }

    // Create new color
    const newColor = await db.insert(schema.colors).values({
      name,
      code
    }).returning();

    logger.info("New color created:", name);
    return res.status(201).json(newColor[0]);
  } catch (error) {
    logger.error("Error creating color:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/colors/:id", async (req, res) => {
  try {
    // Get color ID from URL
    const colorId = parseInt(req.params.id);

    // Check if color exists
    const colorResults = await db.select().from(schema.colors).where(eq(schema.colors.id, colorId));
    if (colorResults.length === 0) {
      return res.status(404).json({ message: "Color not found" });
    }

    // Delete color
    await db.delete(schema.colors).where(eq(schema.colors.id, colorId));

    logger.info("Color deleted:", colorResults[0].name);
    return res.status(204).end();
  } catch (error) {
    logger.error("Error deleting color:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// API routes for diameters
app.get("/api/diameters", async (_req, res) => {
  try {
    // Get diameters from database
    const diametersData = await db.select().from(schema.diameters);
    return res.status(200).json(diametersData);
  } catch (error) {
    logger.error("Error fetching diameters:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/diameters", async (req, res) => {
  try {
    // Parse request body
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);
        return res.status(400).json({ message: "Invalid request format" });
      }
    }

    // Check if this is a CSV import
    if (req.query.import === 'csv' && data.csvData) {
      logger.info("Processing CSV import for diameters");
      const results = {
        created: 0,
        duplicates: 0,
        errors: 0
      };

      // Parse CSV data
      const csvLines = data.csvData.split('\n');
      // Skip header row if present
      const startIndex = csvLines[0].toLowerCase().includes('value') ? 1 : 0;

      // Get existing diameters once to improve performance
      const existingDiameters = await db.select().from(schema.diameters);

      for (let i = startIndex; i < csvLines.length; i++) {
        const line = csvLines[i].trim();
        if (!line) continue;

        try {
          const value = line;

          // Check if diameter already exists
          const exists = existingDiameters.some(d =>
            d.value.toString() === value
          );

          if (exists) {
            results.duplicates++;
            continue;
          }

          // Create new diameter
          await db.insert(schema.diameters).values({
            value
          });

          logger.info(`Created diameter: "${value}" at line ${i + 1}`);
          results.created++;
        } catch (err) {
          logger.error(`Error importing diameter at line ${i + 1}:`, err);
          results.errors++;
        }
      }

      return res.status(201).json(results);
    }

    // Regular single diameter creation
    const { value } = data;
    if (!value) {
      return res.status(400).json({ message: "Value is required" });
    }

    // Check if diameter already exists
    const existingDiameter = await db.select().from(schema.diameters).where(eq(schema.diameters.value, value));
    if (existingDiameter.length > 0) {
      return res.status(400).json({ message: "Diameter already exists" });
    }

    // Create new diameter
    const newDiameter = await db.insert(schema.diameters).values({
      value
    }).returning();

    logger.info("New diameter created:", value);
    return res.status(201).json(newDiameter[0]);
  } catch (error) {
    logger.error("Error creating diameter:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/diameters/:id", async (req, res) => {
  try {
    // Get diameter ID from URL
    const diameterId = parseInt(req.params.id);

    // Check if diameter exists
    const diameterResults = await db.select().from(schema.diameters).where(eq(schema.diameters.id, diameterId));
    if (diameterResults.length === 0) {
      return res.status(404).json({ message: "Diameter not found" });
    }

    // Delete diameter
    await db.delete(schema.diameters).where(eq(schema.diameters.id, diameterId));

    logger.info("Diameter deleted:", diameterResults[0].value);
    return res.status(204).end();
  } catch (error) {
    logger.error("Error deleting diameter:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// API routes for storage locations
app.get("/api/storage-locations", async (_req, res) => {
  try {
    // Get storage locations from database
    const storageLocationsData = await db.select().from(schema.storageLocations);
    return res.status(200).json(storageLocationsData);
  } catch (error) {
    logger.error("Error fetching storage locations:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// API routes for theme settings
app.get("/api/theme", async (req, res) => {
  try {
    // Default theme settings
    const defaultTheme = {
      variant: "professional",
      primary: "#E11D48",
      appearance: "dark",
      radius: 0.8
    };

    // Check if user is authenticated
    if (!req.user) {
      // For non-authenticated users, return default theme
      return res.status(200).json(defaultTheme);
    }

    // Get user theme preference from database
    const userResults = await db.select().from(users).where(eq(users.id, req.user.id));
    if (userResults.length === 0) {
      return res.status(200).json(defaultTheme);
    }

    // If user has theme preferences, return them
    const userTheme = userResults[0].theme;
    if (userTheme) {
      try {
        const parsedTheme = JSON.parse(userTheme);
        return res.status(200).json(parsedTheme);
      } catch (e) {
        logger.error("Error parsing user theme:", e);
        return res.status(200).json(defaultTheme);
      }
    }

    // Otherwise return default theme
    return res.status(200).json(defaultTheme);
  } catch (error) {
    logger.error("Error fetching theme:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/theme", async (req, res) => {
  try {
    // Parse request body
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);
        return res.status(400).json({ message: "Invalid request format" });
      }
    }

    // Validate required fields
    const { primary, variant, appearance, radius } = data;
    if (!primary) {
      return res.status(400).json({ message: "Primary color is required" });
    }

    // Create theme object
    const themeData = {
      primary,
      variant: variant || "professional",
      appearance: appearance || "dark",
      radius: radius || 0.8
    };

    // Check if user is authenticated
    if (!req.user) {
      // For non-authenticated users, just return success without saving
      return res.status(200).json(themeData);
    }

    // Update user theme preference in database
    await db.update(users)
      .set({ theme: JSON.stringify(themeData) })
      .where(eq(users.id, req.user.id));

    logger.info(`User ${req.user.id} updated theme to ${JSON.stringify(themeData)}`);
    return res.status(200).json(themeData);
  } catch (error) {
    logger.error("Error updating theme:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/storage-locations", async (req, res) => {
  try {
    // Parse request body
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        logger.error("Error parsing request body:", e);
        return res.status(400).json({ message: "Invalid request format" });
      }
    }

    // Check if this is a CSV import
    if (req.query.import === 'csv' && data.csvData) {
      logger.info("Processing CSV import for storage locations");
      const results = {
        created: 0,
        duplicates: 0,
        errors: 0
      };

      // Parse CSV data
      const csvLines = data.csvData.split('\n');
      // Skip header row if present
      const startIndex = csvLines[0].toLowerCase().includes('name') ? 1 : 0;

      // Get existing storage locations once to improve performance
      const existingLocations = await db.select().from(schema.storageLocations);

      for (let i = startIndex; i < csvLines.length; i++) {
        const line = csvLines[i].trim();
        if (!line) continue;

        try {
          const name = line;

          // Check if empty name
          if (!name || name.trim() === '') {
            logger.warn(`Empty storage location name at line ${i + 1}, skipping...`);
            continue;
          }

          // Check if storage location already exists
          const existingLocation = existingLocations.find(l =>
            l.name.toLowerCase() === name.toLowerCase()
          );

          if (existingLocation) {
            logger.info(`Duplicate storage location: "${name}" at line ${i + 1}, already exists with ID ${existingLocation.id}`);
            results.duplicates++;
            continue;
          }

          // Create new storage location
          await db.insert(schema.storageLocations).values({
            name
          });

          logger.info(`Created storage location: "${name}" at line ${i + 1}`);
          results.created++;
        } catch (err) {
          logger.error(`Error importing storage location at line ${i + 1}:`, err);
          results.errors++;
        }
      }

      return res.status(201).json(results);
    }

    // Regular single storage location creation
    const { name } = data;
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Check if storage location already exists
    const existingStorageLocation = await db.select().from(schema.storageLocations).where(eq(schema.storageLocations.name, name));
    if (existingStorageLocation.length > 0) {
      return res.status(400).json({ message: "Storage location already exists" });
    }

    // Create new storage location
    const newStorageLocation = await db.insert(schema.storageLocations).values({
      name
    }).returning();

    logger.info("New storage location created:", name);
    return res.status(201).json(newStorageLocation[0]);
  } catch (error) {
    logger.error("Error creating storage location:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/api/storage-locations/:id", async (req, res) => {
  try {
    // Get storage location ID from URL
    const storageLocationId = parseInt(req.params.id);

    // Check if storage location exists
    const storageLocationResults = await db.select().from(schema.storageLocations).where(eq(schema.storageLocations.id, storageLocationId));
    if (storageLocationResults.length === 0) {
      return res.status(404).json({ message: "Storage location not found" });
    }

    // Delete storage location
    await db.delete(schema.storageLocations).where(eq(schema.storageLocations.id, storageLocationId));

    logger.info("Storage location deleted:", storageLocationResults[0].name);
    return res.status(204).end();
  } catch (error) {
    logger.error("Error deleting storage location:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/statistics", async (_req, res) => {
  try {
    // Get statistics from database
    const filamentsData = await db.select().from(filaments);

    // Calculate statistics
    const totalSpools = filamentsData.length;

    // Calculate total weight and remaining weight
    const totalWeight = filamentsData.reduce((sum, f) => sum + Number(f.totalWeight || 0), 0).toFixed(2);
    const remainingWeight = filamentsData.reduce((sum, f) => {
      const remaining = Number(f.totalWeight || 0) * (Number(f.remainingPercentage || 0) / 100);
      return sum + remaining;
    }, 0).toFixed(2);

    // Calculate average remaining percentage
    const averageRemaining = totalSpools > 0
      ? Math.round(filamentsData.reduce((sum, f) => sum + Number(f.remainingPercentage || 0), 0) / totalSpools)
      : 0;

    // Count low stock filaments (less than 25% remaining)
    const lowStockCount = filamentsData.filter(f => Number(f.remainingPercentage || 0) < 25).length;

    // Calculate material distribution
    const materialCounts = {};
    filamentsData.forEach(f => {
      if (f.material) {
        materialCounts[f.material] = (materialCounts[f.material] || 0) + 1;
      }
    });

    const materialDistribution = Object.entries(materialCounts).map(([name, count]) => ({
      name,
      percentage: Math.round((count / totalSpools) * 100)
    })).sort((a, b) => b.percentage - a.percentage);

    // Get top materials
    const topMaterials = materialDistribution
      .slice(0, 5)
      .map(m => m.name);

    // Get top colors
    const colorCounts = {};
    filamentsData.forEach(f => {
      if (f.colorName) {
        colorCounts[f.colorName] = (colorCounts[f.colorName] || 0) + 1;
      }
    });

    const topColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Calculate estimated value and total purchase value
    const totalPurchaseValue = filamentsData.reduce((sum, f) => sum + Number(f.purchasePrice || 0), 0);
    const estimatedValue = filamentsData.reduce((sum, f) => {
      const remaining = Number(f.remainingPercentage || 0) / 100;
      return sum + (Number(f.purchasePrice || 0) * remaining);
    }, 0);

    // Calculate filament age statistics
    const now = new Date();
    const filamentAges = filamentsData
      .filter(f => f.purchaseDate)
      .map(f => {
        const purchaseDate = new Date(f.purchaseDate);
        const ageInDays = Math.floor((now - purchaseDate) / (1000 * 60 * 60 * 24));
        return {
          name: f.name,
          days: ageInDays
        };
      });

    const averageAge = filamentAges.length > 0
      ? Math.round(filamentAges.reduce((sum, f) => sum + f.days, 0) / filamentAges.length)
      : 0;

    const oldestFilament = filamentAges.length > 0
      ? filamentAges.reduce((oldest, current) => current.days > oldest.days ? current : oldest, filamentAges[0])
      : null;

    const newestFilament = filamentAges.length > 0
      ? filamentAges.reduce((newest, current) => current.days < newest.days ? current : newest, filamentAges[0])
      : null;

    return res.status(200).json({
      totalSpools,
      totalWeight,
      remainingWeight,
      averageRemaining,
      lowStockCount,
      materialDistribution,
      topMaterials,
      topColors,
      estimatedValue,
      totalPurchaseValue,
      averageAge,
      oldestFilament,
      newestFilament
    });
  } catch (error) {
    logger.error("Error calculating statistics:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Catch-all route for client-side routing
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
