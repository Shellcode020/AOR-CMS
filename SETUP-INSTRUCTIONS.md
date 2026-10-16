## Website made by Shellcode (Discord: shell.code)
## Made for AO Rebirth Local Servers

--------------------------------------------------

## Database Configuration

## Changing the Config.php File
1. Open \api\config.php
2. Change `AO_DB_HOST`, `AO_DB_PORT`, `AO_DB_NAME` and `AO_DB_PASSWORD` to your own SQL details.
3. Save File

--------------------------------------------------

## Discord News Integration 
## This will display the last 3 posts made in #announcements (or any channel of your choice).

## 1.0 - Create a Discord bot
1. Open https://discord.com/developers/applications and create an application for your Anarchy Online Discord Server.
2. Open Bot, add a bot, and copy its token. Keep it private.
3. Under OAuth2 -> URL Generator, select the `bot` scope and only the permissions View Channels and Read Message History. Open the generated invite URL and add it to your server.
4. In your server, open User Settings -> Advanced -> Developer Mode. (This is needed for later).
5. Under Bot -> Message Content Intent -> Enable

##  2.0 - Setup Discord News
1. Go to https://dash.cloudflare.com/ and sign up for an account.
2. Once logged in, look in the left menu for Build -> Compute -> Workers & Pages
3. Click on Create Application
4. Start with Hello World!
5. Press Deploy
6. On the right top, press Edit Code
7. Remove everything you see there.
8. Open Discord-Worker.js from your downloaded files.
9. Copy everything in this file, and paste it in the Worker.
10. Press Deploy.

## 3.0 - Setup Variables
1. Go to Build -> Compute -> Workers & Pages
2. Select your worker.
3. Click on Settings
4. Click on add variable.
5. Insert DISCORD_BOT_TOKEN as Key, add your Discord Bot Token as Value, make sure "Secret" box is ticked on.
6. Insert DISCORD_GUILD_ID as Key, add your Discord Server ID as Value.
(To find your Discord Server ID -> Right click on your server name in discord -> Copy server ID)
7. Insert DISCORD_CHANNEL_ID as Key, and your discord channel ID  that you want displayed as Value.
(To find your Discord Channel ID -> Right click on the channel name in discord -> Copy channel ID)
8. You are now done, under Overview you see your worker's link, it will look something like green-darkness-8d8d.somename.workers.dev. 
Click on that, and verify that you see the query "{"ok":true,"service":"Anarchy Online News API"}". This means the API is working.
9. Post something in your discord channel.
10. Verify that you see the post in your cloudflare worker by going to your website, for example: https://green-darkness-8d8d.somename.workers.dev/news

## 4.0 - Edit Local File.
1. Open /js/discord-news.js
Change   const API_URL = 'INSERT_URL_HERE';
With your Cloudflare URL, for example: https://green-darkness-8d8d.somename.workers.dev/news
!! Make sure you include /news in the URL otherwise it will not work.

Open your index.html, your news should now be displayed. 
NOTE: There could be a 1 minute delay before it shows up, this is normal. 

--------------------------------------------------