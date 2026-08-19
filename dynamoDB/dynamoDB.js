const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);

const onAppOpen = async (userId, sessionId) => {
  const DAYS_7_IN_SECONDS = 7 * 24 * 60 * 60;
  const expiresAt = Math.floor(Date.now() / 1000) + DAYS_7_IN_SECONDS;

  const command = new PutCommand({
    TableName: "dev-app-sessions",
    Item: {
      userId: userId, // Partition Key (Unica por usuario si solo permites 1 dispositivo)
      sessionId: sessionId, // Token interno de control de sesión
      status: "ACTIVE",
      lastLogin: Math.floor(Date.now() / 1000),
      expiresAt: expiresAt // DynamoDB TTL borrará esto automáticamente si el usuario no vuelve
    }
  });

  await docClient.send(command);
};
const onUserRegistration = async (userId, email, otpHash) => {
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 minutos en segundos

    const command = new PutCommand({
      TableName: "dev-app-otp",
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
    console.error("Error al registrar OTP en DynamoDB:", error);
  }
};

const getUserOtp = async (userId) => {
  const command = new GetCommand({
    TableName: "dev-app-otp",
    Key: { userId: String(userId) }
  });

  return await docClient.send(command);
};

const getAppSession = async (userId) => {
  const command = new GetCommand({
    TableName: "dev-app-sessions",
    Key: { userId }
  });

  return await docClient.send(command);
};

const deleteUserOtp = async (userId) => {
  const command = new DeleteCommand({
    TableName: "dev-app-otp",
    Key: { userId: String(userId) }
  });

  await docClient.send(command);
};

const onUserResend = async (userId, newOtpHash) => {
  const now = Math.floor(Date.now() / 1000);

  const command = new UpdateCommand({
    TableName: "dev-app-otp",
    Key: { userId },

    UpdateExpression:
      "SET otpHash = :otpHash, ttl = :ttl, last_requested = :now, attempts = :zero ADD resend_count :one",

    ConditionExpression:
      "attribute_exists(userId) AND resend_count < :maxResends AND last_requested < :oneMinuteAgo",

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
        "Debes esperar 60 segundos o alcanzaste el límite de reenvíos."
      );
    }

    throw error;
  }
};
const onUserBadAttempt = async (userId) => {
  try {
    const command = new UpdateCommand({
      TableName: "dev-app-otp",
      Key: { userId },

      UpdateExpression: "ADD attempts :one",
      ConditionExpression:
        "attribute_exists(userId) AND attempts < :maxAttempts",
      ExpressionAttributeValues: {
        ":one": 1,
        ":maxAttempts": 5
      },

      ReturnValues: "ALL_NEW"
    });

    const result = await docClient.send(command);
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      throw new Error("Máximo de intentos alcanzado.");
    }
    throw error;
  }
};

const onAppClose = async (userId) => {
  const command = new DeleteCommand({
    TableName: "dev-app-sessions",
    Key: {
      userId: userId
    }
  });

  try {
    await docClient.send(command);
    console.log(
      `Sesión del usuario ${userId} eliminada correctamente de DynamoDB.`
    );
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
};
// const enqueueRegistrationOTP = async ({ userId, email, otp, expiresAt }) => {
//   const apiUrl = process.env.API_GATEWAY_URL + "/send-registration-otp";
//   await axios.post(apiUrl, { userId, email, otp, expiresAt });
// };

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
