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

    groupStates.forEach((state, gIndex) => {
        const accItem = document.createElement('div');
        accItem.className = 'accordion-item';

        const header = document.createElement('div');
        header.className = 'accordion-header';
        if (gIndex === 0) header.classList.add('active');
        header.innerHTML = `
            <span class="group-title">Group ${gIndex + 1}</span>
            <svg class="accordion-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        `;

        const content = document.createElement('div');
        content.className = 'accordion-content';
        if (gIndex === 0) content.style.maxHeight = "10000px";

        const tabBar = document.createElement('div');
        tabBar.className = 'tab-bar';
        content.appendChild(tabBar);

        const grid = document.createElement('div');
        grid.className = 'card-grid';
        grid.id = `grid-${gIndex}`;
        content.appendChild(grid);

        accItem.appendChild(header);
        accItem.appendChild(content);
        container.appendChild(accItem);

        header.addEventListener('click', () => {
            header.classList.toggle('active');
            if (header.classList.contains('active')) {
                content.style.maxHeight = content.scrollHeight + 500 + "px";
            } else {
                content.style.maxHeight = null;
            }
        });

        updateGroupView(gIndex, grid, tabBar, cardDisplayMode);
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
        { key: 'unanswered', label: '繼續', count: counts.unanswered, class: '' },
        { key: 'correct', label: '正確', count: counts.correct, class: 'correct' },
        { key: 'incorrect', label: '錯誤', count: counts.incorrect, class: 'incorrect' }
    ];

    tabBarElement.innerHTML = '';
    
    tabs.forEach(t => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${t.class} ${state.filter === t.key ? 'active' : ''}`;
        btn.innerHTML = `${t.label} <span class="badge">${t.count}</span>`;
        btn.onclick = () => {
            state.filter = t.key;
            updateGroupView(gIndex, gridElement, tabBarElement, cardDisplayMode);
        };
        tabBarElement.appendChild(btn);
    });

    const statsSpan = document.createElement('span');
    statsSpan.className = 'stats-text';
    statsSpan.textContent = `正確率: ${accuracy}%`;
    tabBarElement.appendChild(statsSpan);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'tab-btn reset';
    resetBtn.innerHTML = '↺ 重來';
    resetBtn.onclick = () => {
        state.items = shuffleArray(state.items);
        state.items.forEach(i => i.status = 'unanswered');
        state.filter = 'unanswered';
        updateGroupView(gIndex, gridElement, tabBarElement, cardDisplayMode);
    };
    tabBarElement.appendChild(resetBtn);

    gridElement.innerHTML = '';
    const visibleItems = state.items.filter(item => item.status === state.filter);

    if (visibleItems.length === 0) {
        gridElement.innerHTML = `<div class="empty-msg">沒有單字 (No cards)</div>`;
        gridElement.style.display = 'block';
    } else {
        gridElement.style.display = 'grid';
        visibleItems.forEach(item => {
            const card = createCard(item, gIndex, () => updateGroupView(gIndex, gridElement, tabBarElement, cardDisplayMode), cardDisplayMode);
            if (state.filter !== 'unanswered') {
                card.querySelector('.grade-controls').style.display = 'none';
                card.querySelector('.card-face').style.paddingBottom = '16px';
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
    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';

    const cardContainer = document.createElement('div');
    cardContainer.className = `card-container theme-${theme}`;
    const cardInner = document.createElement('div');
    cardInner.className = 'card-inner';

    const frontFace = document.createElement('div');
    frontFace.className = 'card-face card-front';
    
    const backFace = document.createElement('div');
    backFace.className = 'card-face card-back';

    if (displayMode === 'chinese-first') {
        // Front: Chinese only
        const wordFront = document.createElement('div');
        wordFront.className = 'word-front';
        wordFront.textContent = item.def;
        frontFace.appendChild(wordFront);

        // Back: POS + English + IPA + Sentence + Audio
        const topSection = document.createElement('div');
        topSection.className = 'top-section';
        const posTag = document.createElement('span');
        posTag.className = 'pos-tag';
        posTag.textContent = item.pos;
        topSection.appendChild(posTag);
        backFace.appendChild(topSection);

        const wordBack = document.createElement('div');
        wordBack.className = 'word-back-cn';
        wordBack.style.fontSize = '1.8rem';
        wordBack.style.fontWeight = '700';
        wordBack.style.color = '#1e293b';
        wordBack.style.marginBottom = '8px';
        wordBack.textContent = item.word;

        const ipaText = document.createElement('div');
        ipaText.className = 'word-ipa';
        ipaText.textContent = item.ipa;

        const sentenceBox = document.createElement('div');
        sentenceBox.className = 'sentence-box';
        sentenceBox.textContent = item.sentence;

        const backAudioBtn = document.createElement('button');
        backAudioBtn.className = 'audio-btn';
        backAudioBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        backAudioBtn.onclick = (e) => {
            e.stopPropagation();
            playFullSequence(item.word, item.sentence, backAudioBtn);
        };

        backFace.appendChild(wordBack);
        backFace.appendChild(ipaText);
        backFace.appendChild(sentenceBox);
        backFace.appendChild(backAudioBtn);
    } else {
        // Front: English + IPA + Audio (original mode)
        const wordFront = document.createElement('div');
        wordFront.className = 'word-front';
        wordFront.textContent = item.word;

        const ipaText = document.createElement('div');
        ipaText.className = 'word-ipa';
        ipaText.textContent = item.ipa;

        const frontAudioBtn = document.createElement('button');
        frontAudioBtn.className = 'audio-btn';
        frontAudioBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        frontAudioBtn.onclick = (e) => {
            e.stopPropagation();
            frontAudioBtn.classList.add('playing');
            speak(item.word).then(() => frontAudioBtn.classList.remove('playing'));
        };
        
        frontFace.appendChild(wordFront);
        frontFace.appendChild(ipaText);
        frontFace.appendChild(frontAudioBtn);

        // Back: POS + Chinese + Sentence + Audio
        const topSection = document.createElement('div');
        topSection.className = 'top-section';
        const posTag = document.createElement('span');
        posTag.className = 'pos-tag';
        posTag.textContent = item.pos;
        const wordBack = document.createElement('div');
        wordBack.className = 'word-back-cn';
        wordBack.textContent = item.def;
        topSection.appendChild(posTag);
        topSection.appendChild(wordBack);

        const sentenceBox = document.createElement('div');
        sentenceBox.className = 'sentence-box';
        sentenceBox.textContent = item.sentence;

        const backAudioBtn = document.createElement('button');
        backAudioBtn.className = 'audio-btn';
        backAudioBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        backAudioBtn.onclick = (e) => {
            e.stopPropagation();
            playFullSequence(item.word, item.sentence, backAudioBtn);
        };

        backFace.appendChild(topSection);
        backFace.appendChild(sentenceBox);
        backFace.appendChild(backAudioBtn);
    }

    cardInner.appendChild(frontFace);
    cardInner.appendChild(backFace);
    cardContainer.appendChild(cardInner);

    const controls = document.createElement('div');
    controls.className = 'grade-controls';
    
    const btnIncorrect = document.createElement('button');
    btnIncorrect.className = 'grade-btn btn-incorrect';
    btnIncorrect.innerHTML = '✕';
    btnIncorrect.title = 'Mark as Incorrect';
    btnIncorrect.onclick = (e) => {
        e.stopPropagation();
        markCard(item, 'incorrect', wrapper, refreshCallback);
    };

    const btnCorrect = document.createElement('button');
    btnCorrect.className = 'grade-btn btn-correct';
    btnCorrect.innerHTML = '◯';
    btnCorrect.title = 'Mark as Correct';
    btnCorrect.onclick = (e) => {
        e.stopPropagation();
        markCard(item, 'correct', wrapper, refreshCallback);
    };

    controls.appendChild(btnIncorrect);
    controls.appendChild(btnCorrect);

    cardContainer.addEventListener('click', () => {
        if(cardContainer.classList.contains('locked')) return;
        playFlipSound();
        window.speechSynthesis.cancel();
        if (cardContainer.classList.contains('flipped')) {
            cardContainer.classList.remove('flipped');
        } else {
            cardContainer.classList.add('flipped');
        }
    });

    wrapper.appendChild(cardContainer);
    wrapper.appendChild(controls);
    return wrapper;
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
