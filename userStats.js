const fs = require('fs');
const path = require('path');

class UserStats {
    constructor() {
        this.filePath = path.join(__dirname, 'favorites.json');
        this.data = this.loadData();
    }

    loadData() {
        try {
            return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        } catch (error) {
            return { users: {} };
        }
    }

    saveData() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }

    initUser(userId) {
        if (!this.data.users[userId]) {
            this.data.users[userId] = {
                savedImages: [],
                stats: {
                    totalViews: 0,
                    gamesPlayed: 0,
                    correctGuesses: 0,
                    lastVisit: new Date().toISOString()
                }
            };
            this.saveData();
        }
    }

    updateStats(userId, type) {
        this.initUser(userId);
        const stats = this.data.users[userId].stats;
        
        switch(type) {
            case 'view':
                stats.totalViews++;
                break;
            case 'game':
                stats.gamesPlayed++;
                break;
            case 'correct':
                stats.correctGuesses++;
                break;
        }
        
        stats.lastVisit = new Date().toISOString();
        this.saveData();
    }

    saveImage(userId, imageUrl, breed) {
        this.initUser(userId);
        this.data.users[userId].savedImages.push({
            url: imageUrl,
            breed: breed,
            savedAt: new Date().toISOString()
        });
        this.saveData();
    }

    getUserStats(userId) {
        this.initUser(userId);
        return this.data.users[userId].stats;
    }

    getSavedImages(userId) {
        this.initUser(userId);
        return this.data.users[userId].savedImages;
    }
}

module.exports = new UserStats(); 