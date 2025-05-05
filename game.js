class MatchGame {
    constructor() {
        this.board = [];
        this.ROWS = 7;
        this.COLS = 7;
        this.moves = 18;
        this.score = 0;
        this.level = 1;
        this.difficulty = 'medium'; // Default difficulty
        this.colors = ['red', 'blue', 'green'];
        this.icons = {
            red: '🔥',
            blue: '💧',
            green: '🍃'
        };
        this.selectedBlocks = [];
        this.gameBoard = document.getElementById('game-board');
        this.movesCounter = document.getElementById('moves-counter');
        this.scoreCounter = document.getElementById('score-counter');
        this.levelCounter = document.getElementById('level-counter');
        this.highScoreDisplay = document.getElementById('high-score');
        this.movesProgress = document.getElementById('moves-progress');
        this.levelCompleteModal = document.getElementById('level-complete');
        this.difficultyModal = document.getElementById('difficulty-modal');
        this.isAnimating = false;
        this.comboMultiplier = 1;
        this.lastMatchTime = 0;
        this.comboTimeout = 1500;
        this.shuffleTimer = null;

        // Load high score
        this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
        this.updateHighScore();

        this.setupDifficultyButtons();
        this.showDifficultyModal();
    }

    setupDifficultyButtons() {
        const buttons = document.querySelectorAll('.difficulty-btn');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                this.difficulty = button.dataset.difficulty;
                this.hideDifficultyModal();
                // Initialize game after a short delay to ensure modal is hidden
                setTimeout(() => {
                    this.initializeGame();
                }, 300);
            });
        });
    }

    showDifficultyModal() {
        if (this.difficultyModal) {
            this.difficultyModal.style.display = 'flex';
            // Ensure the modal stays visible
            this.difficultyModal.classList.add('active');
        }
    }

    hideDifficultyModal() {
        if (this.difficultyModal) {
            this.difficultyModal.classList.remove('active');
            // Add a small delay before hiding to allow for animation
            setTimeout(() => {
                this.difficultyModal.style.display = 'none';
            }, 300);
        }
    }

    getDifficultySettings() {
        return {
            easy: {
                moves: 25,
                minMatchSize: 3,
                shuffleInterval: 30000, // 30 seconds
                scoreMultiplier: 0.8
            },
            medium: {
                moves: 18,
                minMatchSize: 2,
                shuffleInterval: 20000, // 20 seconds
                scoreMultiplier: 1.0
            },
            hard: {
                moves: 12,
                minMatchSize: 2,
                shuffleInterval: 10000, // 10 seconds
                scoreMultiplier: 1.2
            }
        };
    }

    setupAutoShuffle() {
        const settings = this.getDifficultySettings()[this.difficulty];
        if (this.shuffleTimer) {
            clearInterval(this.shuffleTimer);
        }
        this.shuffleTimer = setInterval(() => {
            if (!this.isAnimating) {
                this.reshuffleBoard();
                this.renderBoard();
            }
        }, settings.shuffleInterval);
    }

    initializeGame() {
        const settings = this.getDifficultySettings()[this.difficulty];
        this.moves = settings.moves;
        this.updateCounters();
        
        // Clear any existing shuffle timer
        if (this.shuffleTimer) {
            clearInterval(this.shuffleTimer);
        }

        // Initialize the game board
        for (let i = 0; i < this.ROWS; i++) {
            this.board[i] = [];
            for (let j = 0; j < this.COLS; j++) {
                this.board[i][j] = this.getRandomColor();
            }
        }

        // Ensure there are valid moves at start
        while (!this.hasValidMoves()) {
            this.reshuffleBoard();
        }

        this.renderBoard();
        this.updateCounters();
        this.setupAutoShuffle();
    }

    getRandomColor() {
        return this.colors[Math.floor(Math.random() * this.colors.length)];
    }

    renderBoard() {
        if (!this.gameBoard) return;
        
        this.gameBoard.innerHTML = '';
        for (let i = 0; i < this.ROWS; i++) {
            for (let j = 0; j < this.COLS; j++) {
                const block = document.createElement('div');
                block.className = `block ${this.board[i][j]}`;
                block.innerHTML = this.icons[this.board[i][j]];
                block.dataset.row = i;
                block.dataset.col = j;
                block.addEventListener('click', () => this.handleBlockClick(i, j));
                this.gameBoard.appendChild(block);
            }
        }
    }

    async handleBlockClick(row, col) {
        if (this.isAnimating || this.moves <= 0) return;

        const matches = this.findMatchingBlocks(row, col);
        const settings = this.getDifficultySettings()[this.difficulty];
        
        if (matches.length < settings.minMatchSize) return;

        this.isAnimating = true;
        this.moves--;

        // Calculate score with combo system
        const now = Date.now();
        if (now - this.lastMatchTime < this.comboTimeout) {
            this.comboMultiplier = Math.min(this.comboMultiplier + 0.5, 4);
        } else {
            this.comboMultiplier = 1;
        }
        this.lastMatchTime = now;

        const baseScore = matches.length * 10 * settings.scoreMultiplier;
        const comboScore = Math.floor(baseScore * this.comboMultiplier);
        this.score += comboScore;

        // Create particles
        this.createParticles(matches);
        
        // Remove matched blocks with animation
        await this.removeBlocks(matches);
        
        // Apply gravity and fill new blocks
        await this.applyGravity();
        
        this.updateCounters();
        this.isAnimating = false;

        // Check if level is complete (only if no moves left or no valid moves)
        if (this.moves <= 0 || !this.hasValidMoves()) {
            if (this.score >= this.getLevelGoal()) {
                this.showLevelComplete();
            } else {
                this.endGame();
            }
        }
    }

    findMatchingBlocks(row, col) {
        const color = this.board[row][col];
        const matches = [];
        const visited = new Set();

        const check = (r, c) => {
            if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) return;
            const key = `${r},${c}`;
            if (visited.has(key) || this.board[r][c] !== color) return;

            visited.add(key);
            matches.push({row: r, col: c});

            check(r + 1, c);
            check(r - 1, c);
            check(r, c + 1);
            check(r, c - 1);
        };

        check(row, col);
        return matches;
    }

    async removeBlocks(matches) {
        const promises = matches.map(({row, col}) => {
            const block = this.gameBoard.children[row * this.COLS + col];
            block.classList.add('removing');
            this.board[row][col] = null;
            return new Promise(resolve => setTimeout(resolve, 300));
        });
        await Promise.all(promises);
    }

    async applyGravity() {
        // Move blocks down
        for (let col = 0; col < this.COLS; col++) {
            let writeRow = this.ROWS - 1;
            for (let readRow = this.ROWS - 1; readRow >= 0; readRow--) {
                if (this.board[readRow][col] !== null) {
                    if (writeRow !== readRow) {
                        this.board[writeRow][col] = this.board[readRow][col];
                        this.board[readRow][col] = null;
                    }
                    writeRow--;
                }
            }

            // Fill empty spaces
            for (let row = writeRow; row >= 0; row--) {
                this.board[row][col] = this.getRandomColor();
            }
        }

        this.renderBoard();
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    createParticles(matches) {
        matches.forEach(({row, col}) => {
            const block = this.gameBoard.children[row * this.COLS + col];
            if (!block) return;

            const rect = block.getBoundingClientRect();
            for (let i = 0; i < 5; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.cssText = `
                    position: absolute;
                    width: 10px;
                    height: 10px;
                    background: ${getComputedStyle(block).backgroundColor};
                    left: ${rect.left + rect.width/2}px;
                    top: ${rect.top + rect.height/2}px;
                    pointer-events: none;
                `;
                
                const angle = (Math.random() * Math.PI * 2);
                const velocity = 2 + Math.random() * 4;
                const vx = Math.cos(angle) * velocity;
                const vy = Math.sin(angle) * velocity;
                
                document.body.appendChild(particle);
                
                let frame = 0;
                const animate = () => {
                    frame++;
                    const x = parseFloat(particle.style.left) + vx;
                    const y = parseFloat(particle.style.top) + vy + frame * 0.2;
                    const opacity = 1 - frame/30;
                    
                    particle.style.left = x + 'px';
                    particle.style.top = y + 'px';
                    particle.style.opacity = opacity;
                    
                    if (frame < 30) {
                        requestAnimationFrame(animate);
                    } else {
                        particle.remove();
                    }
                };
                requestAnimationFrame(animate);
            }
        });
    }

    hasValidMoves() {
        for (let i = 0; i < this.ROWS; i++) {
            for (let j = 0; j < this.COLS; j++) {
                if (this.findMatchingBlocks(i, j).length >= 2) {
                    return true;
                }
            }
        }
        return false;
    }

    reshuffleBoard() {
        // Create a temporary array of all colors
        const allColors = [];
        for (let i = 0; i < this.ROWS; i++) {
            for (let j = 0; j < this.COLS; j++) {
                if (this.board[i][j]) {
                    allColors.push(this.board[i][j]);
                }
            }
        }

        // Shuffle the colors
        for (let i = allColors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allColors[i], allColors[j]] = [allColors[j], allColors[i]];
        }

        // Place the shuffled colors back on the board
        let colorIndex = 0;
        for (let i = 0; i < this.ROWS; i++) {
            for (let j = 0; j < this.COLS; j++) {
                if (this.board[i][j]) {
                    this.board[i][j] = allColors[colorIndex++];
                }
            }
        }
    }

    getLevelGoal() {
        const settings = this.getDifficultySettings()[this.difficulty];
        const baseGoal = this.level * 500;
        return Math.floor(baseGoal * settings.scoreMultiplier);
    }

    updateCounters() {
        if (this.movesCounter) this.movesCounter.textContent = this.moves;
        if (this.scoreCounter) this.scoreCounter.textContent = this.score;
        if (this.movesProgress) this.movesProgress.style.width = `${(this.moves/18) * 100}%`;
        this.updateHighScore();
    }

    updateHighScore() {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore.toString());
        }
        if (this.highScoreDisplay) {
            this.highScoreDisplay.textContent = `Best: ${this.highScore}`;
        }
    }

    showLevelComplete() {
        if (!this.levelCompleteModal) return;
        
        const finalScore = document.getElementById('final-score');
        const movesLeft = document.getElementById('moves-left');
        const levelBonus = document.getElementById('level-bonus');
        
        if (finalScore) finalScore.textContent = this.score;
        if (movesLeft) movesLeft.textContent = this.moves;
        if (levelBonus) levelBonus.textContent = this.moves * 5;
        
        this.levelCompleteModal.style.display = 'flex';
        this.levelCompleteModal.classList.add('active');
    }

    startNextLevel() {
        this.level++;
        // Adjust moves based on difficulty
        const baseMoves = 18;
        const difficultyMoves = {
            'easy': baseMoves + Math.floor(this.level/2),
            'medium': baseMoves,
            'hard': baseMoves - Math.floor(this.level/3)
        };
        this.moves = Math.max(5, difficultyMoves[this.difficulty]);
        
        if (this.levelCompleteModal) {
            this.levelCompleteModal.style.display = 'none';
            this.levelCompleteModal.classList.remove('active');
        }
        if (this.levelCounter) {
            this.levelCounter.textContent = this.level;
        }
        
        this.initializeGame();
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new MatchGame();
}); 