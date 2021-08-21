import "dotenv/config";
import Discord, { Intents } from "discord.js";
import Help from "./commands/help";
import KotobaListener from "./utils/kotobaListener";
import {
    checkValidCommand,
    splitCommand,
    decideRoles,
    bumpReminder,
    deleteBump,
    setupRandomNewsFeed,
    checkEvents,
    welcome,
} from "./utils";
import { Command, MediaType } from "./types";
import EventHelper from "./utils/eventHelper";
import CancelEvent from "./commands/events/cancel";
import {
    DISBOARD_ID,
    ERROR_COLOR,
    JAPANESE_ROLE,
    JOIN_CHANNELS,
    KOTOBA_DISCRIMINATOR,
    KOTOBA_USERNAME,
    PREFIX,
    RESOURCE_CHANNEL,
} from "./config";
import Schedule from "./commands/events/schedule";
import MediaRecommender from "./commands/media/recommend";
import MediaInfo from "./commands/media/info";

const client = new Discord.Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});
let eventHelper: EventHelper;

client.on("ready", () => {
    eventHelper = new EventHelper(client);
    setupRandomNewsFeed(client);
    checkEvents(client, eventHelper);
});

client.on("message", async (msg: Discord.Message) => {
    // Command List
    if (msg.author.bot !== true && msg.content.startsWith(PREFIX)) {
        const msgText = msg.content;
        const params = splitCommand(msgText);

        if (params) {
            const [cmdName] = params;
            const slicedParams = params.slice(2);

            const cmds: { [key: string]: Command } = {
                "recommend-anime": new MediaRecommender(
                    slicedParams,
                    MediaType.ANIME
                ),
                "recommend-manga": new MediaRecommender(
                    slicedParams,
                    MediaType.MANGA
                ),
                "recommend-vn": new MediaRecommender(
                    slicedParams,
                    MediaType.VISUAL_NOVEL
                ),
                "recommend-ln": new MediaRecommender(
                    slicedParams,
                    MediaType.LIGHT_NOVEL
                ),
                "recommend-drama": new MediaRecommender(
                    slicedParams,
                    MediaType.DRAMA
                ),
                "info-anime": new MediaInfo(slicedParams, MediaType.ANIME),
                "info-manga": new MediaInfo(slicedParams, MediaType.MANGA),
                "info-vn": new MediaInfo(slicedParams, MediaType.VISUAL_NOVEL),
                "info-ln": new MediaInfo(slicedParams, MediaType.LIGHT_NOVEL),
                "info-drama": new MediaInfo(slicedParams, MediaType.DRAMA),
                "create-event": new Schedule(slicedParams, eventHelper),
                "reschedule-event": new Schedule(
                    slicedParams,
                    eventHelper,
                    true
                ),
                "cancel-event": new CancelEvent(eventHelper),
                help: new Help(),
            };

            const chosenCmd = cmds[cmdName];

            if (!checkValidCommand(msgText, chosenCmd)) {
                const cmdErrorEmbed = new Discord.MessageEmbed()
                    .setColor(ERROR_COLOR)
                    .setTitle("Invalid command")
                    .setDescription(
                        `Try \`${PREFIX}\` for instructions on how to use this bot`
                    );
                msg.channel.send({ embeds: [cmdErrorEmbed] });
                return;
            }
            chosenCmd.run(msg);
        }
    }

    // JLPT quiz barrier logic
    if (
        msg.author.username === KOTOBA_USERNAME &&
        msg.author.discriminator === KOTOBA_DISCRIMINATOR &&
        msg.author.bot
    ) {
        const kotoListener = new KotobaListener(msg);
        if (kotoListener.hasGameEnded()) {
            const finishInfo = kotoListener.getFinishInfo();

            if (
                finishInfo &&
                finishInfo.answeredRight >= finishInfo.player.needToGetRight
            ) {
                const jlptRoleTheyHad = KotobaListener.getJlptRoleTheyHad(
                    finishInfo.player
                );

                const quizRole = kotoListener.getQuizRole();
                const japaneseRole = msg.guild?.roles.cache.get(JAPANESE_ROLE);
                decideRoles(
                    finishInfo,
                    quizRole,
                    jlptRoleTheyHad,
                    kotoListener,
                    japaneseRole
                );
            }
        }
    }

    if (msg.author.id === DISBOARD_ID && msg.embeds) {
        const [embed] = msg.embeds;
        if (embed?.description?.includes("Bump done")) {
            deleteBump(client);
            bumpReminder(client);
        }
    }
});

// welcome message
client.on("guildMemberAdd", (member) => {
    JOIN_CHANNELS.forEach((id) => {
        welcome(
            member,
            id,
            `Welcome to The Japan Zone, ${member.user?.username}!`,
            `To gain access to the server, type \`k!quiz n5\` and miss 3 or less on the N5 quiz. Good luck! 
       If you are new to Japanese, we suggest reading a guide in <#${RESOURCE_CHANNEL}>`
        );
    });
});

client.login(process.env.BOT_TOKEN);
