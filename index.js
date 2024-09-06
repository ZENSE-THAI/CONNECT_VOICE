const { Client, Intents } = require('discord.js-selfbot-v13');
const WebSocket = require('ws');
require('dotenv').config();

require('./server.js');

const TOKENS = process.env.DISCORD_TOKENS.split(','); // ใช้หลาย token
const GUILD_ID = process.env.GUILD_ID;
const TARGET_VOICE_CHANNEL_ID = process.env.TARGET_VOICE_CHANNEL_ID;

const CHECK_INTERVAL = 10000; // 10 วินาที
const RECONNECT_INTERVAL = 15000; // 15 วินาที

let bots = [];

function createBot(token) {
    const client = new Client({
        intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES] // ตั้งค่า intents ที่จำเป็น
    });

    let ws;
    let isConnected = false;
    let timeout; 

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}`);
        connectToVoiceChannel(); // เชื่อมต่อไปยังห้องที่กำหนดทันที
        monitorVoiceState(); // ติดตามสถานะห้องเสียง
    });

    function monitorVoiceState() {
        client.on('voiceStateUpdate', (oldState, newState) => {
            if (newState.member.id === client.user.id) {
                clearTimeout(timeout); // ยกเลิกตัวจับเวลาถ้ามีการเปลี่ยนสถานะ

                if (!newState.channelId) { 
                    isConnected = false; 
                    timeout = setTimeout(() => {
                        connectToVoiceChannel(); // เชื่อมต่อใหม่ถ้าออกจากห้องเสียง
                    }, CHECK_INTERVAL); 
                } else if (newState.channelId === TARGET_VOICE_CHANNEL_ID && !isConnected) {
                    isConnected = true;
                }
            }
        });
    }

    function connectToVoiceChannel() {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        const channel = guild.channels.cache.get(TARGET_VOICE_CHANNEL_ID);

        if (channel && channel.type === 'GUILD_VOICE' && !isConnected) {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
            }

            ws.on('open', () => {
                const payload = {
                    op: 2,
                    d: {
                        token: token,
                        intents: 0, 
                        properties: {
                            "$os": "windows",
                            "$browser": "chrome",
                            "$device": "pc"
                        }
                    }
                };
                ws.send(JSON.stringify(payload));

                const voiceStateUpdate = {
                    op: 4,
                    d: {
                        guild_id: GUILD_ID,
                        channel_id: TARGET_VOICE_CHANNEL_ID,
                        self_mute: true,
                        self_deaf: true
                    }
                };
                ws.send(JSON.stringify(voiceStateUpdate));
            });

            ws.on('close', () => {
                isConnected = false;
                setTimeout(connectToVoiceChannel, RECONNECT_INTERVAL);
            });

            ws.on('error', (error) => {
                ws.close();
                setTimeout(connectToVoiceChannel, RECONNECT_INTERVAL); // เชื่อมต่อใหม่หลัง 15 วินาทีถ้ามี error
            });
        }
    }

    client.login(token);
    bots.push({ client, ws, isConnected });
}

// สร้างบอทใหม่ตามจำนวน token ที่มี
TOKENS.forEach(token => createBot(token));
