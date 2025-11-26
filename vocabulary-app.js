// --- 1. Config & State ---
let currentSpeed = 0.70;
const MIN_SPEED = 0.25;
const MAX_SPEED = 2.00;
const SPEED_STEP = 0.05;

// State management for each group
let groupStates = [];

// --- 2. Audio ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playFlipSound() {
    initAudio();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
}

function speak(text, rateOverride) {
    return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) { resolve(); return; }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = rateOverride !== undefined ? rateOverride : currentSpeed;
        utterance.onend = resolve;
        utterance.onerror = resolve;
        window.speechSynthesis.speak(utterance);
    });
}

async function playFullSequence(word, sentence, btn) {
    if(btn) btn.classList.add('playing');
    await speak(word);
    const spellingRate = Math.max(0.3, currentSpeed - 0.15); 
    const spellingText = word.split('').join(' ');
    await speak(spellingText, spellingRate);
    await speak(sentence);
    if(btn) btn.classList.remove('playing');
}

// --- 3. Helper: Shuffle & POS ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getPosType(pos) {
    if (!pos) return "other";
    const p = pos.toLowerCase();
    if (p.includes('n.')) return 'noun';
    if (p.includes('v.')) return 'verb';
    if (p.includes('adj')) return 'adj';
    if (p.includes('adv')) return 'adv';
    return 'other';
}

function updateSpeedDisplay() {
    document.getElementById('speed-display').textContent = currentSpeed.toFixed(2);
}

// --- 4. Data Loading ---
function loadVocabularyData(jsonFilePath, cardDisplayMode = 'english-first') {
    fetch(jsonFilePath)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load vocabulary data');
            }
            return response.json();
        })
        .then(data => {
            // Store data globally so renderAccordions can access it
            window.vocabGroupsRaw = data;
            initializeGroupStates(data);
            renderAccordions(cardDisplayMode);
        })
        .catch(error => {
            console.error('Error loading vocabulary data:', error);
            document.getElementById('app-container').innerHTML =
                '<div class="empty-msg">無法載入單字資料 (Failed to load vocabulary data)</div>';
        });
}

function initializeGroupStates(vocabGroupsRaw) {
    groupStates = [];
    vocabGroupsRaw.forEach((group, idx) => {
        const items = shuffleArray([...group.words]).map((w, i) => ({
            ...w,
            id: i,
            status: 'unanswered'
        }));
        groupStates.push({
            items: items,
            filter: 'unanswered'
        });
    });
}

// --- 5. DOM Logic ---
function initializeApp(jsonFilePath, cardDisplayMode = 'english-first') {
    // Speed Controls
    document.getElementById('speed-down').addEventListener('click', () => {
        if (currentSpeed > MIN_SPEED) {
            currentSpeed -= SPEED_STEP;
            if(currentSpeed < MIN_SPEED) currentSpeed = MIN_SPEED;
            updateSpeedDisplay();
        }
    });
    document.getElementById('speed-up').addEventListener('click', () => {
        if (currentSpeed < MAX_SPEED) {
            currentSpeed += SPEED_STEP;
            if(currentSpeed > MAX_SPEED) currentSpeed = MAX_SPEED;
            updateSpeedDisplay();
        }
    });

    // Scroll Controls
    document.getElementById('btn-top').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('btn-bottom').onclick = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    document.getElementById('btn-up').onclick = () => window.scrollBy({ top: -280, behavior: 'smooth' });
    document.getElementById('btn-down').onclick = () => window.scrollBy({ top: 280, behavior: 'smooth' });

    // Load data
    loadVocabularyData(jsonFilePath, cardDisplayMode);
}

function renderAccordions(cardDisplayMode) {
    const container = document.getElementById('app-container');
    container.innerHTML = '';

    if (!window.vocabGroupsRaw) {
        console.error('Vocabulary data not loaded');
        return;
    }

    const accordionTemplate = document.getElementById('accordion-template');

    window.vocabGroupsRaw.forEach((group, gIndex) => {
        const accItem = accordionTemplate.content.cloneNode(true);
        const accordionDiv = accItem.querySelector('.accordion-item');
        const header = accItem.querySelector('.accordion-header');
        const content = accItem.querySelector('.accordion-content');
        const tabBar = accItem.querySelector('.tab-bar');
        const grid = accItem.querySelector('.card-grid');
        
        // Set title
        accItem.querySelector('.group-title').textContent = group.title;
        
        if (gIndex === 0) {
            header.classList.add('active');
            content.style.maxHeight = "10000px";
        }

        grid.id = `grid-${gIndex}`;
        
        container.appendChild(accItem);
        
        // Get references after appending
        const actualHeader = container.lastElementChild.querySelector('.accordion-header');
        const actualContent = container.lastElementChild.querySelector('.accordion-content');
        const actualGrid = container.lastElementChild.querySelector('.card-grid');
        const actualTabBar = container.lastElementChild.querySelector('.tab-bar');

        actualHeader.addEventListener('click', () => {
            actualHeader.classList.toggle('active');
            if (actualHeader.classList.contains('active')) {
                actualContent.style.maxHeight = actualContent.scrollHeight + 500 + "px";
            } else {
                actualContent.style.maxHeight = null;
            }
        });

        updateGroupView(gIndex, actualGrid, actualTabBar, cardDisplayMode);
    });
}

function updateGroupView(gIndex, gridElement, tabBarElement, cardDisplayMode) {
    const state = groupStates[gIndex];
    
    const counts = {
        unanswered: state.items.filter(i => i.status === 'unanswered').length,
        correct: state.items.filter(i => i.status === 'correct').length,
        incorrect: state.items.filter(i => i.status === 'incorrect').length
    };

    const total = state.items.length;
    const attempted = total - counts.unanswered;
    const accuracy = attempted > 0 ? Math.round((counts.correct / attempted) * 100) : 0;

    const tabs = [
        { key: 'unanswered', label: '繼續', count: counts.unanswered, class: 'unanswered' },
        { key: 'correct', label: '正確', count: counts.correct, class: 'correct' },
        { key: 'incorrect', label: '錯誤', count: counts.incorrect, class: 'incorrect' }
    ];

    tabBarElement.innerHTML = '';
    const tabTemplate = document.getElementById('tab-button-template');
    
    tabs.forEach(t => {
        const tabClone = tabTemplate.content.cloneNode(true);
        const btn = tabClone.querySelector('.tab-btn');
        
        // Only add class if it's not empty
        if (t.class) {
            btn.classList.add(t.class);
        }
        if (state.filter === t.key) {
            btn.classList.add('active');
        }
        
        tabClone.querySelector('.tab-label').textContent = t.label;
        tabClone.querySelector('.badge').textContent = t.count;
        
        tabBarElement.appendChild(tabClone);
        const actualBtn = tabBarElement.lastElementChild;
        actualBtn.onclick = () => {
            state.filter = t.key;
            updateGroupView(gIndex, gridElement, tabBarElement, cardDisplayMode);
        };
    });

    const statsTemplate = document.getElementById('stats-template');
    const statsClone = statsTemplate.content.cloneNode(true);
    statsClone.querySelector('.stats-text').textContent = `正確率: ${accuracy}%`;
    tabBarElement.appendChild(statsClone);

    const resetTemplate = document.getElementById('reset-button-template');
    const resetClone = resetTemplate.content.cloneNode(true);
    tabBarElement.appendChild(resetClone);
    const resetBtn = tabBarElement.lastElementChild;
    resetBtn.onclick = () => {
        state.items = shuffleArray(state.items);
        state.items.forEach(i => i.status = 'unanswered');
        state.filter = 'unanswered';
        updateGroupView(gIndex, gridElement, tabBarElement, cardDisplayMode);
    };

    gridElement.innerHTML = '';
    const visibleItems = state.items.filter(item => item.status === state.filter);

    if (visibleItems.length === 0) {
        gridElement.innerHTML = `<div class="empty-msg">沒有單字 (No cards)</div>`;
        gridElement.style.display = 'block';
    } else {
        gridElement.style.display = 'grid';
        visibleItems.forEach((item) => {
            const card = createCard(item, gIndex, () => updateGroupView(gIndex, gridElement, tabBarElement, cardDisplayMode), cardDisplayMode);
            if (state.filter !== 'unanswered') {
                const gradeControls = card.querySelector('.grade-controls');
                const cardFaces = card.querySelectorAll('.card-face');
                if (gradeControls) gradeControls.style.display = 'none';
                cardFaces.forEach(face => face.style.paddingBottom = '16px');
            }
            gridElement.appendChild(card);
        });
    }
    
    const content = gridElement.parentElement;
    if (content.parentElement.querySelector('.accordion-header').classList.contains('active')) {
         setTimeout(() => {
            content.style.maxHeight = (content.scrollHeight + 100) + "px";
         }, 50);
    }
}

function createCard(item, groupIndex, refreshCallback, displayMode = 'english-first') {
    const theme = getPosType(item.pos);
    const templateId = displayMode === 'chinese-first' ? 'card-template-chinese' : 'card-template-english';
    const template = document.getElementById(templateId);
    const cardClone = template.content.cloneNode(true);
    
    const wrapper = cardClone.querySelector('.card-wrapper');
    const cardContainer = cardClone.querySelector('.card-container');
    cardContainer.classList.add(`theme-${theme}`);
    
    if (displayMode === 'chinese-first') {
        // Front
        cardClone.querySelector('.card-front .word-front').textContent = item.def;
        
        // Back
        const topSection = cardClone.querySelector('.top-section');
        topSection.style.display = 'flex';
        topSection.style.alignItems = 'center';
        topSection.style.justifyContent = 'center';
        topSection.style.gap = '8px';
        topSection.style.marginBottom = '12px';
        
        cardClone.querySelector('.pos-tag').textContent = item.pos;
        
        const backAudio = cardClone.querySelector('.card-back .audio-btn');
        backAudio.style.marginTop = '0';
        backAudio.style.width = '28px';
        backAudio.style.height = '28px';
        
        const wordBack = cardClone.querySelector('.word-back-cn');
        wordBack.textContent = item.word;
        wordBack.style.fontSize = '1.8rem';
        wordBack.style.fontWeight = '700';
        wordBack.style.color = '#1e293b';
        wordBack.style.marginBottom = '8px';
        wordBack.style.width = '100%';
        wordBack.style.textAlign = 'center';
        
        cardClone.querySelector('.word-ipa').textContent = item.ipa;
        cardClone.querySelector('.sentence-box').textContent = item.sentence;
        
        backAudio.onclick = (e) => {
            e.stopPropagation();
            playFullSequence(item.word, item.sentence, backAudio);
        };
    } else {
        // Front
        cardClone.querySelector('.card-front .word-front').textContent = item.word;
        cardClone.querySelector('.card-front .word-ipa').textContent = item.ipa;
        
        const frontAudio = cardClone.querySelector('.card-front .audio-btn');
        frontAudio.onclick = (e) => {
            e.stopPropagation();
            frontAudio.classList.add('playing');
            speak(item.word).then(() => frontAudio.classList.remove('playing'));
        };
        
        // Back
        const topSection = cardClone.querySelector('.top-section');
        topSection.style.display = 'flex';
        topSection.style.alignItems = 'center';
        topSection.style.justifyContent = 'center';
        topSection.style.gap = '8px';
        topSection.style.marginBottom = '12px';
        
        cardClone.querySelector('.pos-tag').textContent = item.pos;
        
        const backAudio = cardClone.querySelector('.card-back .audio-btn');
        backAudio.style.marginTop = '0';
        backAudio.style.width = '28px';
        backAudio.style.height = '28px';
        backAudio.onclick = (e) => {
            e.stopPropagation();
            playFullSequence(item.word, item.sentence, backAudio);
        };
        
        const wordBack = cardClone.querySelector('.word-back-cn');
        wordBack.textContent = item.def;
        wordBack.style.width = '100%';
        wordBack.style.textAlign = 'center';
        wordBack.style.marginBottom = '12px';
        
        cardClone.querySelector('.sentence-box').textContent = item.sentence;
    }
    
    // Create a container to return
    const container = document.createElement('div');
    container.appendChild(cardClone);
    
    // Now get actual DOM elements
    const actualWrapper = container.querySelector('.card-wrapper');
    const actualContainer = container.querySelector('.card-container');
    const actualBtnIncorrect = container.querySelector('.btn-incorrect');
    const actualBtnCorrect = container.querySelector('.btn-correct');
    
    actualBtnIncorrect.onclick = (e) => {
        e.stopPropagation();
        markCard(item, 'incorrect', actualWrapper, refreshCallback);
    };
    
    actualBtnCorrect.onclick = (e) => {
        e.stopPropagation();
        markCard(item, 'correct', actualWrapper, refreshCallback);
    };
    
    actualContainer.addEventListener('click', () => {
        if(actualContainer.classList.contains('locked')) return;
        playFlipSound();
        window.speechSynthesis.cancel();
        if (actualContainer.classList.contains('flipped')) {
            actualContainer.classList.remove('flipped');
        } else {
            actualContainer.classList.add('flipped');
        }
    });
    
    return actualWrapper;
}

function markCard(item, status, domElement, refreshCallback) {
    domElement.style.transition = "transform 0.3s, opacity 0.3s";
    domElement.style.transform = "scale(0.8)";
    domElement.style.opacity = "0";

    setTimeout(() => {
        item.status = status;
        refreshCallback();
    }, 300);
}
