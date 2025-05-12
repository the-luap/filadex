import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import { db, testConnection } from "../server/db.js";
import { users, filaments } from "../shared/schema.js";
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

app.get("/api/statistics", async (_req, res) => {
  try {
    // Get statistics from database
    const filamentsData = await db.select().from(filaments);

    // Calculate statistics
    const totalFilaments = filamentsData.length;
    const totalWeight = filamentsData.reduce((sum, f) => sum + Number(f.totalWeight || 0), 0);
    const totalValue = filamentsData.reduce((sum, f) => sum + Number(f.purchasePrice || 0), 0);

    // Group by material
    const materialCounts = {};
    filamentsData.forEach(f => {
      if (f.material) {
        materialCounts[f.material] = (materialCounts[f.material] || 0) + 1;
      }
    });

    const materialBreakdown = Object.entries(materialCounts).map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalFilaments) * 100)
    }));

    // Group by color
    const colorCounts = {};
    filamentsData.forEach(f => {
      if (f.colorName) {
        colorCounts[f.colorName] = (colorCounts[f.colorName] || 0) + 1;
      }
    });

    const colorBreakdown = Object.entries(colorCounts).map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalFilaments) * 100)
    }));

    // Group by manufacturer
    const manufacturerCounts = {};
    filamentsData.forEach(f => {
      if (f.manufacturer) {
        manufacturerCounts[f.manufacturer] = (manufacturerCounts[f.manufacturer] || 0) + 1;
      }
    });

    const manufacturerBreakdown = Object.entries(manufacturerCounts).map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalFilaments) * 100)
    }));

    return res.status(200).json({
      totalFilaments,
      totalWeight,
      totalValue,
      materialBreakdown,
      colorBreakdown,
      manufacturerBreakdown
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
