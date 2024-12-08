// magicShop.js
const Airtable = require('airtable');
const cron = require('node-cron');

class MagicShop {
  constructor(base) {
    this.base = base;
    this.currentInventory = null;
    this.shopName = '';
    this.lastRefresh = null;
    this.nextRefresh = null;
  }

  async generateShopName() {
    const records = await this.base('Shop Names').select({
      view: "Synced (Do not filter)"
    }).firstPage();
    
    const name = records[Math.floor(Math.random() * records.length)].get('Name');
    const adjective = records[Math.floor(Math.random() * records.length)].get('Adjective');
    const type = records[Math.floor(Math.random() * records.length)].get('Type');
    const descriptor = records[Math.floor(Math.random() * records.length)].get('Descriptor');
    
    return `${name} ${adjective} ${type} ${descriptor}`;
  }

  generateRandomPrice(rarity) {
    const priceRanges = {
      'common': { min: 50, max: 100 },
      'uncommon': { min: 100, max: 500 },
      'rare': { min: 501, max: 5000 },
      'very rare': { min: 5001, max: 50000 }
    };
    
    const range = priceRanges[rarity];
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  }

  async selectItemsByRarity() {
    // Calculate exact number of items for each rarity based on percentages
    const itemCounts = {
      'common': Math.round(7 * 0.5),     // 50% of 7 ≈ 4 items
      'uncommon': Math.round(7 * 0.3),   // 30% of 7 ≈ 2 items
      'rare': Math.round(7 * 0.15),      // 15% of 7 ≈ 1 item
      'very rare': Math.round(7 * 0.05)  // 5% of 7 ≈ 0 items
    };

    // Adjust counts to ensure total is exactly 7
    const total = Object.values(itemCounts).reduce((sum, count) => sum + count, 0);
    if (total < 7) {
      itemCounts['common'] += 7 - total;
    }

    let selectedItems = [];
    const usedItems = new Set();

    // Get all magic items and spells
    const magicItems = await this.base('Magic Items').select({
      view: "Synced (Do not filter)"
    }).firstPage();

    const spells = await this.base('Spells').select({
      view: "Synced (Do not filter)"
    }).firstPage();

    // Process each rarity
    for (const [rarity, count] of Object.entries(itemCounts)) {
      const itemsOfRarity = magicItems.filter(item => 
        item.get('Rarity').toLowerCase() === rarity && !usedItems.has(item.id)
      );

      const spellsForScrolls = spells.filter(spell => 
        this.getSpellRarity(spell.get('Level')) === rarity
      );

      for (let i = 0; i < count; i++) {
        // Decide whether to add a magic item or spell scroll
        const isSpellScroll = Math.random() < 0.3; // 30% chance for spell scroll

        if (isSpellScroll && spellsForScrolls.length > 0) {
          const spell = spellsForScrolls[Math.floor(Math.random() * spellsForScrolls.length)];
          const scrollItem = {
            name: `Spell Scroll of ${spell.get('Name')}`,
            type: 'Spell Scroll',
            path: spell.get('path'),
            rarity: rarity,
            price: this.generateRandomPrice(rarity),
            attunement: false
          };
          selectedItems.push(scrollItem);
        } else if (itemsOfRarity.length > 0) {
          const availableItems = itemsOfRarity.filter(item => !usedItems.has(item.id));
          if (availableItems.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableItems.length);
            const item = availableItems[randomIndex];
            usedItems.add(item.id);
            selectedItems.push({
              name: item.get('Name'),
              type: item.get('Type'),
              path: item.get('path'),
              rarity: item.get('Rarity').toLowerCase(),
              price: item.get('Price') || this.generateRandomPrice(rarity),
              attunement: item.get('Attunement') || false
            });
          } else {
            // If we run out of items, create a spell scroll instead
            const spell = spellsForScrolls[Math.floor(Math.random() * spellsForScrolls.length)];
            const scrollItem = {
              name: `Spell Scroll of ${spell.get('Name')}`,
              type: 'Spell Scroll',
              path: spell.get('path'),

              rarity: rarity,
              price: this.generateRandomPrice(rarity),
              attunement: false
            };
            selectedItems.push(scrollItem);
          }
        }
      }
    }

    // Double check we have exactly 7 items
    if (selectedItems.length !== 7) {
      console.warn(`Generated ${selectedItems.length} items instead of 7. Adjusting...`);
      while (selectedItems.length < 7) {
        // Add common spell scrolls if we're short
        const commonSpells = spells.filter(spell => this.getSpellRarity(spell.get('Level')) === 'common');
        const spell = commonSpells[Math.floor(Math.random() * commonSpells.length)];
        selectedItems.push({
          name: `Spell Scroll of ${spell.get('Name')}`,
          type: 'Spell Scroll',
          path: spell.get('path'),

          rarity: 'common',
          price: this.generateRandomPrice('common'),
          attunement: false
        });
      }
      // If we somehow got more than 7, truncate
      selectedItems = selectedItems.slice(0, 7);
    }

    return selectedItems.sort((a, b) => a.price - b.price);
  }

  getSpellRarity(level) {
    level = level.toLowerCase();
    
    if (level === '0' || level === '1st') return 'common';
    if (level === '2nd' || level === '3rd') return 'uncommon';
    if (level === '4th' || level === '5th') return 'rare';
    if (level === '6th' || level === '7th' || level === '8th' || level === '9th') return 'very rare';
    
    return 'common';
  }

  getTimeUntilRefresh() {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timeLeft = midnight - now;
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    return {
      hours,
      minutes,
      seconds,
      total: timeLeft
    };
  }

  async refreshShop() {
    this.shopName = await this.generateShopName();
    this.currentInventory = await this.selectItemsByRarity();
    this.lastRefresh = new Date();
    this.nextRefresh = new Date(this.lastRefresh);
    this.nextRefresh.setHours(24, 0, 0, 0);
    
    return {
      shopName: this.shopName,
      inventory: this.currentInventory,
      nextRefresh: this.nextRefresh
    };
  }
}

module.exports = MagicShop;