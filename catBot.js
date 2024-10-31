const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();
const userStats = require('./userStats');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

try {
    // הגדרות בסיסיות
    const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
    
    // פונקציה להתחלת הבוט עם התעלמות מהודעות ישנות
    async function startBot() {
        try {
            // קבלת העדכון האחרון
            const updates = await bot.getUpdates();
            const lastUpdateId = updates.length > 0 ? updates[updates.length - 1].update_id : 0;
            
            // מחיקת כל העדכונים הישנים
            await bot.getUpdates({ offset: lastUpdateId + 1, limit: 1 });
            
            // התחלת האזנה להודעות חדשות בלבד
            bot.startPolling({
                restart: true,
                onlyFirstMatch: true
            });
            
            console.log('🤖 הבוט המשודרג התחיל לפעול!');
        } catch (error) {
            console.error('שגיאה בהפעלת הבוט:', error);
            process.exit(1);
        }
    }

    // הפעלת הבוט
    startBot();

    // קבועים
    const CAT_API_URL = 'https://api.thecatapi.com/v1/images/search';
    const CAT_API_BREEDS = 'https://api.thecatapi.com/v1/breeds';
    const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs/search';
    const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

    // תפריט ראשי משודרג - מוגדר לפני השימוש
    const mainKeyboard = {
        reply_markup: {
            keyboard: [
                ['🖼️ תמונת חתול', '🎯 חידון חתולים'],
                ['🎪 גיף חתול מצחיק', 'ℹ️ אודות'],
                ['🏆 גזעי חתולים', '📊 סטטיסטיקות']
            ],
            resize_keyboard: true
        }
    };

    // הגדרת כל הפונקציות
    async function sendRandomCat(chatId) {
        try {
            const loadingMsg = await bot.sendMessage(chatId, '✨ מחפש חתול מיוחד בשבילך...');
            const response = await axios.get(`${CAT_API_URL}?has_breeds=1`);
            const catData = response.data[0];
            
            userStats.updateStats(chatId, 'view');
            await bot.deleteMessage(chatId, loadingMsg.message_id);
            
            await bot.sendPhoto(chatId, catData.url, {
                caption: `
╭─────༺♡༻─────╮
   *חתול מקסים במיוחד!* 🌟
${catData.breeds?.[0]?.name ? `\n🏆 *גזע:* ${catData.breeds[0].name}` : ''}
╰─────༺♡༻─────╯`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔄 חתול אחר', callback_data: 'refresh' },
                            { text: '❤️ שמור', callback_data: `save_${catData.url}_${catData.breeds?.[0]?.name || 'Unknown'}` },
                            { text: '📤 שתף', callback_data: 'share' }
                        ]
                    ]
                }
            });
        } catch (error) {
            console.error('Error in sendRandomCat:', error);
            bot.sendMessage(chatId, '😿 אופס! משהו השתבש... נסה שוב');
        }
    }

    async function startGuessGame(chatId) {
        try {
            const response = await axios.get(CAT_API_BREEDS);
            const breeds = response.data;
            const correctBreed = breeds[Math.floor(Math.random() * breeds.length)];
            const options = [correctBreed.name];
            
            // בחית 3 גזעים רנדומליים נוספים
            while (options.length < 4) {
                const randomBreed = breeds[Math.floor(Math.random() * breeds.length)].name;
                if (!options.includes(randomBreed)) {
                    options.push(randomBreed);
                }
            }
            
            // שיטת ערבוב משופרת להבטחת אקראיות מלאה
            function shuffleArray(array) {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            }
            
            const shuffledOptions = shuffleArray(options);
            
            const catResponse = await axios.get(`${CAT_API_URL}?breed_ids=${correctBreed.id}`);
            
            await bot.sendPhoto(chatId, catResponse.data[0].url, {
                caption: `
╭─────༺🎯༻─────╮
   *חידון חתולים!*
╰─────༺🎯༻─────╮

*איזה גזע חתול זה?* 🤔`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: shuffledOptions.map(option => [{
                        text: option,
                        callback_data: `guess_${option === correctBreed.name ? 'correct' : 'wrong'}`
                    }])
                }
            });
        } catch (error) {
            bot.sendMessage(chatId, '😿 לא הצלחתי להתחיל את החידון...');
        }
    }

    async function sendCatGif(chatId) {
        try {
            const loadingMsg = await bot.sendMessage(chatId, '🎬 מחפש גיף מצחיק במיוחד...');
            const response = await axios.get(`${GIPHY_API_URL}?api_key=${GIPHY_API_KEY}&q=funny+cat&limit=1&offset=${Math.floor(Math.random() * 100)}`);
            const gifUrl = response.data.data[0].images.original.url;
            
            await bot.deleteMessage(chatId, loadingMsg.message_id);
            await bot.sendAnimation(chatId, gifUrl, {
                caption: `
╭─────༺😹༻─────╮
   *גיף חתולי מצחיק!*
╰─────༺😹༻─────╯`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🎪 גיף נוסף', callback_data: 'more_gif' },
                        { text: '📤 שתף', switch_inline_query: '' }
                    ]]
                }
            });
        } catch (error) {
            bot.sendMessage(chatId, '😿 לא הצלחתי למצוא גיף... נסה שוב!');
        }
    }

    async function sendBreedInfo(chatId) {
        try {
            const response = await axios.get(CAT_API_BREEDS);
            const breeds = response.data;
            const randomBreed = breeds[Math.floor(Math.random() * breeds.length)];
            
            let breedMessage = `
╭──────《 🏆 》──────╮
   *${randomBreed.name}*
╰──────《 🏆 》──────╯

👋 *מוצא:* ${randomBreed.origin || 'לא ידוע'}
📏 *משקל:* ${randomBreed.weight?.metric || 'לא ידוע'} ק"ג
⭐ *אופי:* ${randomBreed.temperament || 'לא ידוע'}
ℹ️ *תיאור:* ${randomBreed.description || 'אין מידע נוסף'}
            `;

            // מנסה להביא תמונה של הגזע
            try {
                const catResponse = await axios.get(`${CAT_API_URL}?breed_ids=${randomBreed.id}`);
                await bot.sendPhoto(chatId, catResponse.data[0].url, {
                    caption: breedMessage,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔄 גזע אחר', callback_data: 'next_breed' },
                            { text: '📚 מידע נוסף', url: randomBreed.wikipedia_url || null }
                        ]]
                    }
                });
            } catch {
                // אם אין תמונה, שולח רק טקסט
                await bot.sendMessage(chatId, breedMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔄 גזע אחר', callback_data: 'next_breed' }
                        ]]
                    }
                });
            }
        } catch (error) {
            bot.sendMessage(chatId, '😿 מצטער, לא הצלחתי להביא מידע על גזעים כרגע.');
        }
    }

    async function sendAbout(chatId) {
        const aboutMessage = `
╭──────《 ℹ️ 》──────╮
   *אודות בוט החתולים*
╰──────《 ℹ️ 》──────╯

🤖 בוט זה נוצר כדי להביא לכם את:
• התמונות היפות ביותר של חתולים
• מידע על גזעים שונים
• עובדות מעניינות
• משחקים והפתעות!

📱 *פקודות זמינות:*
/start - התחלה מחדש

💝 *נוצר באהבה על ידי:*
@Haim113
        `;
        
        await bot.sendMessage(chatId, aboutMessage, {
            parse_mode: 'Markdown',
            ...mainKeyboard
        });
    }

    // הודעת פתיחה משודרגת
    bot.onText(/\/start/, (msg) => {
        const welcomeMessage = `
╭─────༺🐱༻────╮
   *ברוכים הבאים!*
╰─────༺🐱༻─────╯

✨ *מה אפשר לעשות כאן?*
• 🖼️ לראות תמונות חתולים מהממות
• 🎪 לצפות בגיפים מצחיקים
• 🎯 לשחק משחק ניחושי גזעים
• 🏆 ללמוד על גזעי חתולים

*השתמש בכפתורים למטה כדי להתחיל* 🚀`;
        
        bot.sendMessage(msg.chat.id, welcomeMessage, {
            parse_mode: 'Markdown',
            ...mainKeyboard
        });
    });

    // הגדרת כל ההאזנות לאירועים
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        if (!msg.text) return;

        switch(msg.text) {
            case '🖼 תמונת חתול':
                await sendRandomCat(chatId);
                break;
            case '🎯 חידון חתולים':
                await startGuessGame(chatId);
                break;
            case '🎪 גיף חתול מצחיק':
                await sendCatGif(chatId);
                break;
            case '🏆 גזעי חתולים':
                await sendBreedInfo(chatId);
                break;
            case 'ℹ️ אודות':
                await sendAbout(chatId);
                break;
        }
    });

    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        
        if (query.data === 'refresh') {
            await sendRandomCat(chatId);
        } else if (query.data === 'share') {
            await handleShare(chatId, query.message.message_id);
        } else if (query.data.startsWith('save_')) {
            const [_, url, breed] = query.data.split('_');
            userStats.saveImage(chatId, url, breed);
            await bot.answerCallbackQuery(query.id, { text: '✨ התמונה נשמרה בהצלחה!' });
        }
    });

    // נוסיף פונקציה חדשה לטיפול בשיתוף
    async function handleShare(chatId, messageId) {
        try {
            await bot.sendMessage(chatId, 'בחר איך תרצה לשתף:', {
                reply_to_message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '📤 שתף בקבוצה', switch_inline_query: 'share_cat' },
                            { text: '📨 שתף עם חבר', switch_inline_query_current_chat: 'share_cat' }
                        ]
                    ]
                }
            });
        } catch (error) {
            console.error('Error in handleShare:', error);
            bot.sendMessage(chatId, '😿 לא הצלחתי לשתף... נסה שוב מאוחר יותר');
        }
    }

    // נוסיף פונקציה להצגת סטטיסטיקות
    async function showStats(chatId) {
        try {
            const stats = userStats.getUserStats(chatId);
            const savedImages = userStats.getSavedImages(chatId);
            
            const message = `
📊 *הסטטיסטיקות שלך:*
━━━━━━━━━━━━━━━
👀 צפית ב-${stats.totalViews} תמונות
🎮 שיחקת ${stats.gamesPlayed} משחקים
✅ ניחשת נכון ${stats.correctGuesses} פעמים
💝 שמרת ${savedImages.length} תמונות
🕒 ביקור אחרון: ${new Date(stats.lastVisit).toLocaleDateString('he-IL')}
`;
            
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Error in showStats:', error);
            bot.sendMessage(chatId, '😿 לא הצלחתי להציג סטטיסטיקות... נסה שוב');
        }
    }

    // נוסיף פקודה חדשה להצגת סטטיסטיקות
    bot.onText(/\/stats/, (msg) => showStats(msg.chat.id));

    app.get('/', (req, res) => {
        res.send('הבוט פעיל! 🤖');
    });

    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });

} catch (error) {
    console.error('שגיאה:', error);
    process.exit(1);
}
