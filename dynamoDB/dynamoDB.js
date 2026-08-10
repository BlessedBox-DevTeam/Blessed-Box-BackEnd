import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);

const onAppOpen = async (userId, sessionToken) => {
  const DAYS_7_IN_SECONDS = 7 * 24 * 60 * 60;
  const expiresAt = Math.floor(Date.now() / 1000) + DAYS_7_IN_SECONDS;

  const command = new PutCommand({
    TableName: "dev-app-sessions",
    Item: {
      userId: userId, // Partition Key (Unica por usuario si solo permites 1 dispositivo)
      sessionToken: sessionToken, // Token interno de control de sesión
      status: "ACTIVE",
      lastLogin: new Date().toISOString(),
      expiresAt: expiresAt // DynamoDB TTL borrará esto automáticamente si el usuario no vuelve
    }
  });

  await docClient.send(command);
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
const enqueueRegistrationOTP = async ({ userId, email, otp, expiresAt }) => {
  const apiUrl = process.env.API_GATEWAY_URL + "/send-registration-otp";
  await axios.post(apiUrl, { userId, email, otp, expiresAt });
};

module.exports = {
  onAppOpen,
  onAppClose,
  enqueueRegistrationOTP
};
