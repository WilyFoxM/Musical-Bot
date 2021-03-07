// Information
    // Spotify
    const SpotifyAPI = {
        ID: process.env.SPID,
        Secret: process.env.SPSECRET
    }

    // SoundCloud
    const SCID = process.env.SCID

    // YT API
    const YTAPI = process.env.YTAPI

    // Discord
    const token = process.env.TOKEN;
    const prefix = '*';

//Bot client
const Discord = require('discord.js');
const bot = new Discord.Client();

// Express Server
const express = require('express');
const app = express();
const port = process.env.PORT;
app.get('/', (req, res) => res.send('Working...'))


// YTDL
const ytdl = require('ytdl-core-discord');

// YT search
const search = require('youtube-search');

// YT API
const YouTubeAPI = require("simple-youtube-api");
let youtube = new YouTubeAPI(YTAPI);

// SoundCloud API
const scdl = require('soundcloud-downloader').default
const { Util: SoundCloudUtil } = require('soundcloud-scraper');
const SoundCloud = require('soundcloud-scraper');
const client = new SoundCloud.Client();

// Spotify
const SpotifyWebApi = require('spotify-web-api-node');
let spotifyApi = new SpotifyWebApi({
    clientId: SpotifyAPI.ID,
    clientSecret: SpotifyAPI.Secret,
    redirectUri: ''
});

// Utils
const { Util } = require('discord.js');

// Servers Queue
let queue = new Map();

// On start
bot.on('ready', () => {
    console.log(`Music bot logged ${bot.user.username}`);
    bot.generateInvite(["ADMINISTRATOR"]).then(link => {
        console.log(link);
    })

    bot.user.setActivity("*play");
});

// On message
bot.on('message', async message =>{
    // Protect
    if(message.author.id == bot.user.id) return;
    if(!message.content.startsWith(prefix)) return;

    // Get server queue
    let serverQueue = queue.get(message.guild.id);

    // Play commands
    if(message.content.startsWith(prefix + 'play') || message.content.startsWith(prefix + 'p')) {
        execute(message, serverQueue);
        return;
    }
    if(message.content.startsWith(prefix + 'skip') || message.content.startsWith(prefix + 'next')) {
        skip(message, serverQueue);
        return;
    }
    if(message.content.startsWith(prefix + 'stop') || message.content.startsWith(prefix + 'quit') || message.content.startsWith(prefix + 'leave')) {
        stop(message, serverQueue);
        return;
    }
    if(message.content.startsWith(prefix + 'loop')) {
        loop(message, serverQueue);
        return;
    }
    if(message.content.startsWith(prefix + 'queue') || message.content.startsWith(prefix + 'songs')) {
        queueCommand(message, serverQueue);
        return;
    }
    if(message.content.startsWith(prefix + 'pause')) {
        pause(message, serverQueue);
        return;
    }
    if(message.content.startsWith(prefix + 'skipto') || message.content.startsWith(prefix + 'to')) {
        skipto(message, serverQueue);
        return;
    }
    if(message.content.startsWith(prefix + 'time') || message.content.startsWith(prefix + 'long')) {
        time(message, serverQueue);
        return;
    }

    // Spotify test
    if(message.content.startsWith(prefix + 'test')) {
        spotify(message);
        return;
    }

    // FX commands
    if(message.content.startsWith(prefix + 'bassboost') || message.content.startsWith(prefix + 'bb') || message.content.startsWith(prefix + 'bass')) {
        bassboost(message, serverQueue);
        return;
    }
});

const spotify = message => {
    spotifyApi.getPlaylist('1qcw8XwZMqc1whs4OBjWvv')
    .then(data => {
        console.log('Playlist: ', data.body);
    }, err => {
        console.error(err);
    });
}

const execute = async (message, serverQueue) => {
    let params = message.content.split(' ').slice(1).join(' ');
    reg = /https?:\/\/(?:youtu\.be\/|(?:[a-z]{2,3}\.)?youtube\.com\/watch(?:\?|#\!)v=)([\w-]{11}).*/;
    let playlistPattern = /^.*(list=)([^#\&\?]*).*/gi;
    let url;
    let songInfo;
    let isYT = false;
    let embed;
    let isPlaylist = false;

    if (SoundCloudUtil.validateURL(params) && !params.includes("/sets/")) {
        songInfo = await client.getSongInfo(params).catch(e => { console.error(`Track parse error: ${e}`); });
        if (!songInfo) return message.channel.send('Nothing found');
    } else if (reg.test(params)) {
        url = params;
        isYT = true;
    } else {
        isYT = true;
        let opts1 = {
            maxResults: 1,
            key: YTAPI,
            type: 'video'
        };
        let results = await search(params, opts1).catch(err => console.log(err, 'AAAaaaaAAAAAAAAAAAaaaaaaaaaaa'));
        if (!results) { return message.channel.send('Cant play this song'); }
        let ytResult = results.results;
        let linkYT = ytResult.map(result =>{
            return result.link;
        });
        url = linkYT[0];
        if(ytResult.length == 0){
            return message.channel.send('Ничего не найдено');
        }
    }

    let voiceChannel = message.member.voice.channel;
    if(!voiceChannel) message.channel.send('Enter voice channel');
    if(!params) { message.channel.send('Enter YouTube URL'); return }
    let song;
    let playlistName;

    let queueContruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 5,
        playing: true,
        loopTrack: false,
        paused: false,
        bassBoost: false,
        queued: false,
    };

    if (playlistPattern.test(params)) {

        let playlist = null;
        let videos = [];

        playlist = await youtube.getPlaylist(url, { part: "snippet" });
        videos = await playlist.getVideos(50, { part: "snippet" });
        playlistName = playlist.raw.snippet.title;

        let newSongs = videos
            .filter((video) => video.title != "Private video" && video.title != "Deleted video")
            .map((video) => {
                return (song = {
                    title: video.title,
                    url: video.url,
                    time: video.durationSeconds,
                    views: video.viewCount,
                    isSC: false,
                    fromPlaylit: true,
                    playlist: playlistName
                });
            });
        if (serverQueue) { serverQueue.songs.push(...newSongs) } else { queueContruct.songs.push(...newSongs); }
        embed = new Discord.MessageEmbed()
        .setTitle('Added playlist')
        .setColor("#ed1532")
        .addFields(
            { name: 'Name', value: playlistName },
            { name: 'Tracks', value: newSongs.length }
        )
        message.channel.send(embed);
        isPlaylist = true;

    } else if (params.includes("/sets/")) {
        let playlist = null;
        let videos = [];

        playlist = await scdl.getSetInfo(params, SCID);
        playlistName = playlist.title;

        videos = playlist.tracks.map((track) => ({
            title: track.title,
            url: track.permalink_url,
            duration: track.duration / 1000
        }));

        let newSongs = videos
            .filter((video) => video.title != "Private video" && video.title != "Deleted video")
            .map((video) => {
                return (song = {
                    title: video.title,
                    url: video.url,
                    time: video.durationSeconds,
                    isSC: true,
                    fromPlaylit: true,
                    playlist: playlistName
                });
            });
        console.log(newSongs);
        if (serverQueue) { serverQueue.songs.push(...newSongs) } else { queueContruct.songs.push(...newSongs); }
        embed = new Discord.MessageEmbed()
        .setTitle('Added playlist')
        .setColor("#ed1532")
        .addFields(
            { name: 'Name', value: playlistName },
            { name: 'Tracks', value: newSongs.length }
        )
        message.channel.send(embed);
        isPlaylist = true;

    } else {
        if (isYT) {
            await ytdl.getInfo(url).then(data => {
                song = {
                    title: data.videoDetails.title,
                    url: data.videoDetails.video_url,
                    thumb: data.player_response.videoDetails.thumbnail.thumbnails[0].url,
                    time: data.videoDetails.lengthSeconds,
                    views: data.videoDetails.viewCount,
                    isSC: false,
                };
            });
        } else {
            song = {
                title: Util.escapeMarkdown(songInfo.title),
                url: songInfo.url,
                thumb: songInfo.thumbnail,
                time: songInfo.duration,
                views: 'SoundCloud',
                isSC: true,
            }
            Object.defineProperty(song, '_raw', { value: songInfo });
        }
    }

    if (!serverQueue) {
        queue.set(message.guild.id, queueContruct);
        queueContruct.songs.push(song);

        try {
            let connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
        } catch (error) {
            queue.delete(message.guild.id);
            console.log(error, 'queueContruct Error');
            return;
        }
    } else {
        serverQueue.songs.push(song);

        let time = song.time;
        if(!song.isSC) {
            let timecode = song.time;
            let timecodemin = Math.floor(timecode / 60);
            let timecodesec = timecode - (timecodemin * 60);
            if (timecodesec < 10) { timecodesec = '0' + timecodesec }
            time = `${timecodemin}:${timecodesec}`;
        } else {
            let timecodemin = Math.floor((time / 1000) / 60);
            let timecodesec = (time / 1000) - timecodemin * 60;
            time = `${timecodemin}:${timecodesec}`;
        }
        if (!playlistPattern.test(params)) {
            if (!isPlaylist) {
                embed = new Discord.MessageEmbed()
                .setColor("#ed1532")
                .setThumbnail(song.thumb)
                .setTitle(`Added to queue:`)
                .setDescription(`${song.title}`)
                .addFields(
                    { name: 'Views', value: song.views },
                    { name: 'Time', value: time }
                )
                .setURL(`${song.url}`);
            }
        }
        message.channel.send(embed);
    }
}

const play = async (guild, song) => {
    let serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    let time = song.time;
    if(!song.isSC) {
        let timecode = song.time;
        let timecodemin = Math.floor(timecode / 60);
        let timecodesec = timecode - (timecodemin * 60);
        if (timecodesec < 10) { timecodesec = '0' + timecodesec }
        time = `${timecodemin}:${timecodesec}`;
    } else {
        let timecodemin = Math.floor((time / 1000) / 60);
        let timecodesec = (time / 1000) - timecodemin * 60;
        time = `${timecodemin}:${timecodesec}`;
    }
    
    let embed;

    if (!song.fromPlaylit) {
        embed = new Discord.MessageEmbed()
            .setColor("#ed1532")
            .setThumbnail(song.thumb)
            .setTitle(`Playing:`)
            .setDescription(`${song.title}`)
            .addFields(
                { name: 'Views', value: song.views },
                { name: 'Time', value: `${time}` }
            )
            .setURL(`${song.url}`);
    } else {
        embed = new Discord.MessageEmbed()
        .setColor("#ed1532")
        .setTitle(`Playing:`)
        .setDescription(`${song.title}`)
        .addFields(
            { name: 'Playlist', value: song.playlist },
        )
        .setURL(`${song.url}`);
    }
    let msg;
    let addedArgs = { highWaterMark: 1024 * 1024 * 10 };
    if (serverQueue.bassBoost) { addedArgs = { highWaterMark: 1024 * 1024 * 10, encoderArgs: ['-af', `bass=g=10`] }; }

    if (serverQueue.loopTrack) {
        msg = await serverQueue.textChannel.send(embed);

        if (!song.isSC) {
            let stream = await ytdl(song.url, addedArgs);
            let streamType = 'opus';
            let dispatcher = serverQueue.connection
            .play(stream, { type: streamType })
            .on('finish', async () => {
                play(guild, serverQueue.songs[0]);
                try {
                    msg.delete();
                } catch (e) {}
            });
            dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
        } else {
            let stream;
            let streamType = 'ogg/opus';
            try {
                stream = await scdl.downloadFormat(song.url, scdl.FORMATS.OPUS, SCID);
            } catch (error) {
                stream = await scdl.downloadFormat(song.url, scdl.FORMATS.MP3, SCID);
                streamType = "unknown";
            }
            let dispatcher = serverQueue.connection
            .play(stream, { type: streamType })
            .on('finish', () => {
                play(guild, serverQueue.songs[0]);
                try {
                    msg.delete();
                } catch (e) {}
            })
			dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
        }
    } else if (!serverQueue.loopTrack) {
        msg = await serverQueue.textChannel.send(embed);

        if (!song.isSC) {
            let stream = await ytdl(song.url, addedArgs).catch(e => {
                serverQueue.songs.shift();
                play(guild, serverQueue.songs[0]);
                try {
                    msg.delete();
                } catch (e) {}
                return;
            });
            let streamType = 'opus';
            let dispatcher = serverQueue.connection
            .play(stream, { type: streamType })
            .on('finish', async () => {
                serverQueue.songs.shift();
                play(guild, serverQueue.songs[0]);
                try {
                    msg.delete();
                } catch (e) {}
            });
            dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
        } else {
            let stream;
            let streamType = 'ogg/opus';
            try {
                stream = await scdl.downloadFormat(song.url, scdl.FORMATS.OPUS, SCID);
            } catch (error) {
                stream = await scdl.downloadFormat(song.url, scdl.FORMATS.MP3, SCID);
                streamType = "unknown";
            }
            let dispatcher = serverQueue.connection
            .play(stream, { type: streamType })
            .on('finish', () => {
                serverQueue.songs.shift();
                play(guild, serverQueue.songs[0]);
                try {
                    msg.delete();
                } catch (e) {}
            })
            dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
        }
    }
}

const time = (message, serverQueue) => {
    if (!message.member.voice.channel) return message.channel.send('Enter voice channel');
    if (!serverQueue || serverQueue.song == []) return message.channel.send('Nothing to skip');

    let totalTimeSec;
    for (let i = 0; i < serverQueue.songs.length; i++) {
        totalTimeSec += Number(serverQueue.songs[i].time);
    }

    let time = ``;
    let timeMins = Math.floor(totalTimeSec / 60);
    let timeHours = Math.floor(totalTimeSec / 60);
    let timeSec = totalTimeSec - timeMins * 60;
    if (timeSec < 10) { timeSec = '0' + String(timeSec) }
    if (timeHours <= 0) { time = `${timeMins}:${timeSec}` } else { 
        if (timeMins < 10) { timeMins = '0' + String(timeMins) }
        time = `${timeHours}:${timeMins}:${timeSec}` 
    }
    
}

const skip = (message, serverQueue) => {
    if (!message.member.voice.channel) return message.channel.send('Enter voice channel');
    if (!serverQueue || serverQueue.song == []) return message.channel.send('Nothing to skip');
    if (serverQueue.connection.dispatcher) {
        serverQueue.connection.dispatcher.end();
    } else {
        serverQueue.songs.shift();
        play(serverQueue.songs[0]);
    }
}

const skipto = (message, serverQueue) => {
    if (!message.member.voice.channel) return message.channel.send('Enter voice channel');
    if (!serverQueue || serverQueue.song == []) return message.channel.send('Nothing to skip');
    let dest = Number(Math.abs(Math.floor(message.content.split(' ')[1]))) - 1;
    if (dest <= 0 || dest > serverQueue.songs.length) { return message.channel.send('Incorrect pointer'); }

    let current = serverQueue.songs[1];
    let to = serverQueue.songs[dest];

    serverQueue.songs.push(current);
    serverQueue.songs[1] = to;
    serverQueue.songs.slice(dest);

    if (serverQueue.connection.dispatcher) {
        serverQueue.connection.dispatcher.end();
    } else {
        play(serverQueue.songs[0]);
    }
}

const bassboost = (message, serverQueue) => {
    if (!message.member.voice.channel) return message.channel.send('Enter voice channel');
    if (!serverQueue || serverQueue.song == []) return message.channel.send('Nothing to skip');
    serverQueue.bassBoost = true;
    message.channel.send('Bass boosted');
}

const pause = (message, serverQueue) => {
    if (!message.member.voice.channel) return message.channel.send('Enter voice channel');
    if (!serverQueue || serverQueue.song == []) return message.channel.send('Nothing to pause');
    if (!serverQueue.connection.dispatcher) {
        serverQueue.songs.shift();
        play(serverQueue.songs[0]);
    }
    if (serverQueue.paused) {
        serverQueue.connection.dispatcher.resume();
        serverQueue.paused = false;
        return message.channel.send('Resumed');
    } else if (!serverQueue.paused) {
        serverQueue.connection.dispatcher.pause();
        serverQueue.paused = true;
        return message.channel.send('Paused');
    }
    
}

const queueCommand = (message, serverQueue) => {
    if (!message.member.voice.channel) return message.channel.send('Enter voice channel');
    if (!serverQueue || serverQueue.song == []) return message.channel.send('Nothing to see');
    if(serverQueue.queued) { return };

    serverQueue.queued = true;

    let id = message.author.id;
    let str = '';
    let songs = serverQueue.songs;

    if (songs.length > 10) {
        for (let i = 0; i < 10; i++) {
            str += `${i + 1}. ${songs[i].title}\n`
        }
        let embed = new Discord.MessageEmbed()
            .setColor('#c0ffee')
            .setDescription('```' + str + '```')
        message.channel.send(embed).then(message => {
            message.react('1️⃣');
            if (songs.length > 10) message.react('2️⃣');
            if (songs.length > 20) message.react('3️⃣');
            if (songs.length > 30) message.react('4️⃣');
            if (songs.length > 40) message.react('5️⃣');
            if (songs.length >= 50) message.react('6️⃣');
            message.react('❌');

            let filter = (reaction, user) => {
                return reaction.emoji.name == '❌' && user.id != bot.user.id || 
                reaction.emoji.name == '1️⃣' && user.id != bot.user.id || 
                reaction.emoji.name == '2️⃣' && user.id != bot.user.id || 
                reaction.emoji.name == '3️⃣' && user.id != bot.user.id || 
                reaction.emoji.name == '4️⃣' && user.id != bot.user.id || 
                reaction.emoji.name == '5️⃣' && user.id != bot.user.id || 
                reaction.emoji.name == '6️⃣' && user.id != bot.user.id;
            }
            let collector = new Discord.ReactionCollector(message, filter, { time: 180000});

            collector.on('collect', async (reaction, user) => {
                if(reaction.emoji.name == '❌') {
                    serverQueue.queued = false;
                    try{
                        message.delete();
                    } catch(e) {}
                    return;
                } else if(reaction.emoji.name == '1️⃣') {
                    str = '';
                    let limit;
                    if (songs.length >= 10) { limit = 10 } else { limit = songs.length }
                    for (let i = 0; i < 10; i++) {
                        str += `${i + 1}. ${songs[i].title}\n`
                    }
                    let newembed = new Discord.MessageEmbed()
                        .setColor('#c0ffee')
                        .setDescription('```' + str + '```')
                    message.edit(newembed);
                    message.reactions.resolve('1️⃣').users.remove(user.id);
                } else if (reaction.emoji.name == '2️⃣') {
                    str = '';
                    let limit;
                    if (songs.length >= 20) { limit = 20 } else { limit = songs.length }
                    for (let i = 10; i < limit; i++) {
                        str += `${i + 1}. ${songs[i].title}\n`
                    }
                    let newembed = new Discord.MessageEmbed()
                        .setColor('#c0ffee')
                        .setDescription('```' + str + '```')
                    message.edit(newembed);
                    message.reactions.resolve('2️⃣').users.remove(user.id);
                } else if (reaction.emoji.name == '3️⃣') {
                    str = '';
                    let limit;
                    if (songs.length >= 30) { limit = 30 } else { limit = songs.length }
                    for (let i = 20; i < limit; i++) {
                        str += `${i + 1}. ${songs[i].title}\n`
                    }
                    let newembed = new Discord.MessageEmbed()
                        .setColor('#c0ffee')
                        .setDescription('```' + str + '```')
                    message.edit(newembed);
                    message.reactions.resolve('3️⃣').users.remove(user.id);
                } else if (reaction.emoji.name == '4️⃣') {
                    str = '';
                    let limit;
                    if (songs.length >= 40) { limit = 40 } else { limit = songs.length }
                    for (let i = 30; i < limit; i++) {
                        str += `${i + 1}. ${songs[i].title}\n`
                    }
                    let newembed = new Discord.MessageEmbed()
                        .setColor('#c0ffee')
                        .setDescription('```' + str + '```')
                    message.edit(newembed);
                    message.reactions.resolve('4️⃣').users.remove(user.id);
                } else if (reaction.emoji.name == '5️⃣') {
                    str = '';
                    let limit;
                    if (songs.length >= 50) { limit = 50 } else { limit = songs.length }
                    for (let i = 40; i < limit; i++) {
                        str += `${i + 1}. ${songs[i].title}\n`
                    }
                    let newembed = new Discord.MessageEmbed()
                        .setColor('#c0ffee')
                        .setDescription('```' + str + '```')
                    message.edit(newembed);
                    message.reactions.resolve('5️⃣').users.remove(user.id);
                } else if (reaction.emoji.name == '6️⃣') {
                    str = '';
                    for (let i = 50; i < songs.length; i++) {
                        str += `${i + 1}. ${songs[i].title}\n`
                    }
                    let newembed = new Discord.MessageEmbed()
                        .setColor('#c0ffee')
                        .setDescription('```' + str + '```')
                    message.edit(newembed);
                    message.reactions.resolve('6️⃣').users.remove(user.id);
                }
            });
        });
    } else {
        for (let i = 0; i < songs.length; i++) {
            str += `${i + 1}. ${songs[i].title}\n`
        }
        let embed = new Discord.MessageEmbed()
            .setColor('#c0ffee')
            .setDescription('```' + str + '```')
        message.channel.send(embed);
        serverQueue.queued = false;
    }
}

const loop = (message, serverQueue) => {
    if (!message.member.voice.channel) return message.channel.send('Enter voice channel');
    if (!serverQueue || serverQueue.song == []) return message.channel.send('Nothing to loop');
    if (!serverQueue.loopTrack) {
        serverQueue.loopTrack = true;
        let song = {
            title: serverQueue.songs[0].title,
            url: serverQueue.songs[0].url,
            thumb: serverQueue.songs[0].thumb,
            time: serverQueue.songs[0].time,
            views: serverQueue.songs[0].views,
            isSC: serverQueue.songs[0].isSC,
        };
        serverQueue.songs.push(song);
        return message.channel.send('Loop current track');
    } else if (serverQueue.loopTrack) {
        serverQueue.loopTrack = false;
        return message.channel.send('Playing queue');
    }
    
}

const stop = (message, serverQueue) => {
    if (!message.member.voice.channel) return message.channel.send('Enter voice channel');
    if (!serverQueue || serverQueue.song == []) {
        try {
            message.member.voice.channel.leave();
            return;
        } catch (error) {
            return;
        }
    }
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

app.listen(port, () => bot.login(token));
