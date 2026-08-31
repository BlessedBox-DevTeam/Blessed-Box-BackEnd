const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const REGION = process.env.AWS_REGION || "us-east-2";
const QUEUE_URL = process.env.SQS_QUEUE_URL;

if (!QUEUE_URL) {
  throw new Error(
    "SQS_QUEUE_URL is not defined in environment variables."
  );
}

const sqsClient = new SQSClient({ region: REGION });

const sendMessageToSqs = async ({
  eventType,
  userId,
  email,
  name,
  lastName,
  otp
}) => {
  try {
    const messageBody = JSON.stringify({
      eventType,
      payload: {
        userId,
        email,
        name,
        lastName,
        otp,
        createdAt: new Date().toISOString()
      }
    });

    const command = new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: messageBody,
      MessageAttributes: {
        eventType: {
          DataType: "String",
          StringValue: eventType
        }
      }
    });

    return await sqsClient.send(command);
  } catch (error) {
    console.error("Error sending message to SQS:", error);
    throw error;
  }
};
const sendRegistrationMessage = async (payload) =>
  sendMessageToSqs({ eventType: "USER_REGISTRATION", ...payload });

const sendOtpMessage = async (payload) =>
  sendMessageToSqs({ eventType: "OTP_RESEND", ...payload });

module.exports = {
  sendRegistrationMessage,
  sendOtpMessage
};
