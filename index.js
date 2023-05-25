const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "auth" }),
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("whatsapp bot siap");
});

client.on("message", async (msg) => {
  if (msg.body === "hai") {
    msg.reply("Hai ada yang bisa dibantu");
    console.log(msg.body);
  }
  if (msg.hasMedia) {
    const media = await msg.downloadMedia();
    console.log(media);
  }
});

client.initialize();
