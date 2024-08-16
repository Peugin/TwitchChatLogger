const {SlashCommandBuilder} = require('discord.js');
const tmi = require('tmi.js');
const dotenv = require('dotenv');

const holding = {};

dotenv.config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('twitch-chat-logger')
        .setDescription('Start use twitch chat logger.')
        .setDescriptionLocalizations({
            ChineseTW: '開始使用 Twitch 聊天室記錄器。'
        })
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setNameLocalizations({
                    ChineseTW: '開始'
                })
                .setDescription('Start Log twitch chat.')
                .setDescriptionLocalizations({
                    ChineseTW: '開始記錄指定的聊天室內容'
                })
                .addStringOption(option =>
                    option.setName('username')
                        .setNameLocalizations({
                            ChineseTW: '使用者名稱'
                        })
                        .setDescription(`Specify user's chat room.`)
                        .setDescriptionLocalizations({
                            ChineseTW: '指定的聊天室頻道'
                        })
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setNameLocalizations({
                    ChineseTW: '停止'
                })
                .setDescription('Stop Logging twitch chat.')
                .setDescriptionLocalizations({
                    ChineseTW: '停止記錄指定的聊天室內容'
                })
                .addStringOption(option =>
                    option.setName('username')
                        .setNameLocalizations({
                            ChineseTW: '使用者名稱'
                        })
                        .setDescription(`Specify user's chat room.`)
                        .setDescriptionLocalizations({
                            ChineseTW: '指定的聊天室頻道'
                        })
                        .setRequired(true))),
    async execute(interaction) {
        switch (interaction.options.getSubcommand()) {
            case 'start': {
                await executeStartCommand(interaction);
                break;
            }
            case 'stop': {
                await executeStopCommand(interaction);
                break;
            }
        }
    }
};

async function executeStartCommand(interaction) {
    const username = interaction.options.getString('username');

    if (holding[username] !== undefined) {
        interaction.reply({
            content: `已經建立了 ${username} 的聊天室記錄器。`,
            ephemeral: true
        });
        return;
    }

    const client = createTwitchClient(username);
    await client.connect();

    //建立 thread 並進入
    let thread = await interaction.channel.threads.cache.find(thread => thread.name === `${username}-${new Date().toLocaleDateString("zh-TW")}`);
    if (thread === undefined || !thread.joined) {
        thread = await interaction.channel.threads.create({
            name: `${username}-${new Date().toLocaleDateString("zh-TW")}`
        });
    }
    await thread.join();

    client.on('message', (channel, tags, message) => {
        if (tags['display-name'].toLowerCase() === tags.username) {
            thread.send({
                content: `${tags['display-name']}: ${message}`
            });
        } else {
            thread.send({
                content: `${tags['display-name']} (${tags.username}): ${message}`
            });
        }
    });

    (holding[username] ||= new Map()).set(interaction.channel.id,
        {
            "client": client,
            "thread": thread
        });

    //完成訊息
    interaction.reply({
        content: `已成功建立 ${username} 的聊天室記錄器。`,
        ephemeral: true
    });
}

async function executeStopCommand(interaction) {
    const username = interaction.options.getString('username');
    const item = holding[username].get(interaction.channel.id);

    if (item['client'] !== undefined) {
        item['client'].disconnect();
        await item['thread'].setLocked(true);
        delete holding[username][interaction.channel.id];

        //完成訊息
        interaction.reply({
            content: `已成功停止 ${username} 的聊天室記錄器。`,
            ephemeral: true
        });
    } else {
        //完成訊息
        interaction.reply({
            content: `${username} 的聊天室記錄器並不存在。`,
            ephemeral: true
        });
    }
}

function createTwitchClient(username) {
    return new tmi.Client({
        identity: {
            username: process.env.TWITCH_USERNAME,
            password: process.env.TWITCH_PASSWORD
        },
        channels: [username]
    });
}