const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");
const REGION = process.env.AWS_REGION || "us-east-2";
const SESSIONS_TABLE =
  process.env.DYNAMODB_SESSIONS_TABLE ||
  (process.env.NODE_ENV === "production"
    ? "prod-app-sessions"
    : "dev-app-sessions");
const OTP_TABLE =
  process.env.DYNAMODB_OTP_TABLE ||
  (process.env.NODE_ENV === "production" ? "prod-app-otp" : "dev-app-otp");

if (!SESSIONS_TABLE || !OTP_TABLE) {
  throw new Error(
    "DYNAMODB_SESSIONS_TABLE and DYNAMODB_OTP_TABLE are required in production."
  );
}

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const onAppOpen = async (userId, sessionId) => {
  try {
    const DAYS_7_IN_SECONDS = 7 * 24 * 60 * 60;
    const expiresAt = Math.floor(Date.now() / 1000) + DAYS_7_IN_SECONDS;

    const command = new PutCommand({
      TableName: SESSIONS_TABLE,
      Item: {
        userId: String(userId), // Partition Key (Unique per user if you only allow 1 device)
        sessionId: sessionId, // Internal session control token
        status: "ACTIVE",
        lastLogin: Math.floor(Date.now() / 1000),
        expiresAt: expiresAt // DynamoDB TTL will automatically delete this if the user doesn't return
      }
    });
    await docClient.send(command);
  } catch (error) {
    console.error(error);
    throw error;
  }
};
const onUserRegistration = async (userId, email, otpHash) => {
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 minutos en segundos

    const command = new PutCommand({
      TableName: OTP_TABLE,
      Item: {
        userId: String(userId),
        email: email,
        otpHash: otpHash,
        ttl: expiresAt,
        attempts: 0,
        resend_count: 0,
        last_requested: Math.floor(Date.now() / 1000)
      }
    });
    await docClient.send(command);
  } catch (error) {
    console.error("Error registering OTP in DynamoDB:", error);
    throw error;
  }
};

const getUserOtp = async (userId) => {
  const command = new GetCommand({
    TableName: OTP_TABLE,
    Key: { userId: String(userId) }
  });

  return await docClient.send(command);
};

const getAppSession = async (userId) => {
  const command = new GetCommand({
    TableName: SESSIONS_TABLE,
    Key: { userId: String(userId) }
  });

  return await docClient.send(command);
};

const deleteUserOtp = async (userId) => {
  const command = new DeleteCommand({
    TableName: OTP_TABLE,
    Key: { userId: String(userId) }
  });

  await docClient.send(command);
};

const onUserResend = async (userId, newOtpHash) => {
  const now = Math.floor(Date.now() / 1000);

  const command = new UpdateCommand({
    TableName: OTP_TABLE,
    Key: { userId: String(userId) },

    UpdateExpression:
      "SET otpHash = :otpHash, #ttl = :ttl, last_requested = :now, attempts = :zero ADD resend_count :one",

    ConditionExpression:
      "attribute_exists(userId) AND resend_count < :maxResends AND last_requested < :oneMinuteAgo",

    ExpressionAttributeNames: {
      "#ttl": "ttl"
    },

    ExpressionAttributeValues: {
      ":otpHash": newOtpHash,
      ":ttl": now + 900,
      ":now": now,
      ":oneMinuteAgo": now - 60,
      ":maxResends": 3,
      ":one": 1,
      ":zero": 0
    }
  });

  try {
    await docClient.send(command);
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      throw new Error(
        "You must wait 60 seconds or you have reached the resend limit.",
        { cause: error }
      );
    }

    throw error;
  }
};
const onUserBadAttempt = async (userId) => {
  try {
    const command = new UpdateCommand({
      TableName: OTP_TABLE,
      Key: { userId: String(userId) },

      UpdateExpression: "ADD attempts :one",
      ConditionExpression:
        "attribute_exists(userId) AND attempts < :maxAttempts",
      ExpressionAttributeValues: {
        ":one": 1,
        ":maxAttempts": 5
      },

      ReturnValues: "ALL_NEW"
    });

    await docClient.send(command);
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      throw new Error("Maximum attempts reached.", { cause: error });
    }
    throw error;
  }
};

const onAppClose = async (userId) => {
  const command = new DeleteCommand({
    TableName: SESSIONS_TABLE,
    Key: {
      userId: String(userId)
    }
  });

  try {
    await docClient.send(command);
  } catch (error) {
    console.error("Error closing session:", error);
    throw error;
  }
};

module.exports = {
  onAppOpen,
  onAppClose,
  onUserRegistration,
  getUserOtp,
  getAppSession,
  deleteUserOtp,
  onUserResend,
  onUserBadAttempt
};
