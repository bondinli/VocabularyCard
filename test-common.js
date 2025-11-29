let allWords = [];
let groupedWords = {};
let currentWords = [];

// Helpers
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

function getPosColor(pos) {
    const type = getPosType(pos);
    const colors = {
        'noun': { bg: '#eff6ff', color: '#3b82f6' },
        'verb': { bg: '#fef2f2', color: '#ef4444' },
        'adj': { bg: '#ecfdf5', color: '#10b981' },
        'adv': { bg: '#fffbeb', color: '#f59e0b' },
        'other': { bg: '#f5f3ff', color: '#8b5cf6' }
    };
    return colors[type] || colors['other'];
}

// Load JSON and flatten / group by title
function loadVocabularyData(jsonFilePath, callback) {
    fetch(jsonFilePath)
        .then(response => {
            if (!response.ok) throw new Error('Failed to load vocabulary data');
            return response.json();
        })
        .then(data => {
            groupedWords = {};
            allWords = [];
            data.forEach(group => {
                groupedWords[group.title] = group.words || [];
                allWords = allWords.concat(group.words || []);
            });
            callback();
        })
        .catch(error => {
            console.error('Error loading vocabulary data:', error);
            alert('無法載入單字資料');
        });
}

// Generate accordion grouped by title (sorted)
function generateCards(testType) {
    const container = document.getElementById('cards-grid');
    if (!container) return;
    container.innerHTML = '';

    const accordion = document.createElement('div');
    accordion.className = 'test-accordion';

    const titles = Object.keys(groupedWords).sort((a, b) => a.localeCompare(b, 'zh-Hant-TW'));

    titles.forEach((title, groupIndex) => {
        const words = groupedWords[title] || [];

        const item = document.createElement('div');
        item.className = 'test-accordion-item';

        const header = document.createElement('div');
        header.className = 'test-accordion-header';
        if (groupIndex === 0) header.classList.add('active');

        header.innerHTML = `
            <div class="test-group-title">
                ${title}
                <span class="test-group-count">${words.length} 個單字</span>
            </div>
            <svg class="test-accordion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6"/>
            </svg>
        `;

        const content = document.createElement('div');
        content.className = 'test-accordion-content';
        if (groupIndex === 0) content.classList.add('active');

        const grid = document.createElement('div');
        grid.className = 'cards-grid';

        const templateId = testType === 'en2zh' ? 'en2zh-card-template' : 'zh2en-card-template';
        const template = document.getElementById(templateId);
        if (!template) return;

        words.forEach((word, index) => {
            const clone = template.content.cloneNode(true);
            const card = clone.querySelector('.test-card');
            const posTag = card.querySelector('.word-pos');
            const posColors = getPosColor(word.pos);
            if (posTag) {
                posTag.textContent = word.pos || '';
                posTag.style.background = posColors.bg;
                posTag.style.color = posColors.color;
            }

            const cardWord = card.querySelector('.card-word');
            const answerInput = card.querySelector('.answer-input');

            if (testType === 'en2zh') {
                if (cardWord) cardWord.textContent = word.word || '';
                if (answerInput) answerInput.dataset.correctAnswer = (word.def || '').toString().trim();
            } else {
                if (cardWord) cardWord.textContent = word.def || '';
                const wordLower = (word.word || '').toString().toLowerCase();
                if (answerInput) {
                    answerInput.placeholder = wordLower ? `${wordLower[0]}...${wordLower[wordLower.length - 1]}` : '';
                    answerInput.dataset.correctAnswer = wordLower;
                }
            }

            if (answerInput) {
                answerInput.dataset.groupTitle = title;
                answerInput.dataset.index = `${groupIndex}-${index}`;
            }

            grid.appendChild(clone);
        });

        content.appendChild(grid);
        item.appendChild(header);
        item.appendChild(content);
        accordion.appendChild(item);

        header.addEventListener('click', () => {
            const isActive = header.classList.toggle('active');
            if (isActive) {
                content.classList.add('active');
                // expand
                content.style.maxHeight = content.scrollHeight + "px";
            } else {
                content.classList.remove('active');
                content.style.maxHeight = null;
            }
        });

        // ensure first content expanded height set
        if (groupIndex === 0) {
            content.style.maxHeight = content.scrollHeight + "px";
        }
    });

    container.appendChild(accordion);
    currentWords = allWords;
}

// Check answers, handle empty as unanswered, compute stats
function checkAnswers(testType) {
    const inputs = document.querySelectorAll('.answer-input');
    let correct = 0;
    let totalQuestions = inputs.length;
    let attempted = 0; // will count all inputs (empty included as attempted)
    let groupResults = {};

    inputs.forEach(input => {
        const raw = input.value || '';
        const userAnswer = raw.trim();
        const correctAnswer = (input.dataset.correctAnswer || '').toString();
        const groupTitle = input.dataset.groupTitle || 'Unknown';
        const feedback = input.parentElement.querySelector('.feedback');

        if (!groupResults[groupTitle]) groupResults[groupTitle] = { correct: 0, total: 0, attempted: 0 };

        groupResults[groupTitle].total++;
        // Treat every input as attempted (empty => incorrect)
        attempted++;
        groupResults[groupTitle].attempted++;

        // reset classes
        input.classList.remove('correct', 'incorrect', 'unanswered');

        let isCorrect = false;

        if (!userAnswer) {
            // Empty -> count as incorrect
            isCorrect = false;
            input.classList.add('incorrect');
            if (feedback) {
                feedback.className = 'feedback incorrect';
                feedback.innerHTML = `✗ 未輸入（視為錯誤）<br><span class="correct-answer">正確答案：${correctAnswer}</span>`;
            }
        } else {
            // Non-empty -> normal validation
            if (testType === 'zh2en') {
                const normalize = txt => txt.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
                const nu = normalize(userAnswer);
                const nc = normalize(correctAnswer);
                if (nu === nc || nc.includes(nu) || nu.includes(nc)) isCorrect = true;
            } else {
                const normalizeZh = txt => txt.replace(/[，。！？；：、（）「」『』《》【】\s]/g, '').trim();
                const nu = normalizeZh(userAnswer);
                const nc = normalizeZh(correctAnswer);
                if (nu === nc || nc.includes(nu) || nu.includes(nc)) isCorrect = true;
                if (!isCorrect && nu.length > 0 && nc.length > 0) {
                    let matchCount = 0;
                    for (let ch of nu) if (nc.includes(ch)) matchCount++;
                    const matchRate = matchCount / Math.max(1, nc.length);
                    if (matchRate >= 0.7) isCorrect = true;
                }
            }

            if (isCorrect) {
                input.classList.add('correct');
                if (feedback) {
                    feedback.className = 'feedback correct';
                    feedback.innerHTML = '✓ 正確！<span class="correct-answer" style="display:block;margin-top:4px;font-size:0.9em;color:#059669;">正確答案：' + correctAnswer + '</span>';
                }
                correct++;
                groupResults[groupTitle].correct++;
            } else {
                input.classList.add('incorrect');
                if (feedback) {
                    feedback.className = 'feedback incorrect';
                    feedback.innerHTML = `✗ 錯誤<br><span class="correct-answer">正確答案：${correctAnswer}</span>`;
                }
            }
        }
    });

    showResult({ correct, totalQuestions, attempted, groupResults });
    setTimeout(() => {
        const rp = document.getElementById('result-panel');
        if (rp) rp.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
}

// Show result summary and per-group breakdown
function showResult(stats) {
    const { correct, totalQuestions, attempted, groupResults } = stats;
    const resultPanel = document.getElementById('result-panel');
    if (!resultPanel) return;
    const resultIcon = resultPanel.querySelector('.result-icon');
    const resultText = resultPanel.querySelector('.result-text');
    const resultScore = resultPanel.querySelector('.result-score');

    // attempted equals totalQuestions (empty counted as incorrect)
    const percentage = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

    if (percentage === 100) {
        resultIcon.textContent = '🎉';
        resultText.textContent = '完美！全部答對！';
        resultText.style.color = '#10b981';
    } else if (percentage >= 90) {
        resultIcon.textContent = '🌟';
        resultText.textContent = '太棒了！';
        resultText.style.color = '#10b981';
    } else if (percentage >= 80) {
        resultIcon.textContent = '😊';
        resultText.textContent = '很好！';
        resultText.style.color = '#10b981';
    } else if (percentage >= 70) {
        resultIcon.textContent = '👍';
        resultText.textContent = '不錯！';
        resultText.style.color = '#f59e0b';
    } else if (percentage >= 60) {
        resultIcon.textContent = '💪';
        resultText.textContent = '加油！';
        resultText.style.color = '#f59e0b';
    } else {
        resultIcon.textContent = '📚';
        resultText.textContent = '繼續努力！';
        resultText.style.color = '#ef4444';
    }

    let html = `
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:8px;">
            題目總數：${totalQuestions}，已作答（含空輸入視為錯誤）：${attempted}
        </div>
        <div style="font-size:1.3rem;font-weight:700;margin-bottom:8px;">
            答對 <span style="color:#10b981;">${correct}</span> / ${attempted} 題
        </div>
        <div style="font-size:1.6rem;font-weight:800;color:${percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444'};">
            ${attempted > 0 ? percentage + '%' : '0%'}
        </div>
    `;

    if (Object.keys(groupResults).length) {
        html += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e6eef8;">';
        html += '<div style="font-size:1rem;color:#64748b;margin-bottom:8px;">各組成績（空輸入視為錯誤）：</div>';
        for (let g in groupResults) {
            const gd = groupResults[g];
            const gAttempted = gd.attempted || 0;
            const gCorrect = gd.correct || 0;
            const gPercent = gAttempted > 0 ? Math.round((gCorrect / gAttempted) * 100) : 0;
            const gColor = gPercent >= 80 ? '#10b981' : gPercent >= 60 ? '#f59e0b' : '#ef4444';
            html += `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin-bottom:8px;background:#fbfdff;border-radius:8px;">
                    <div style="font-weight:600;color:#334155;">${g}</div>
                    <div style="text-align:right;">
                        <div style="font-weight:700;color:${gColor};">${gCorrect}/${gAttempted} (${gPercent}%)</div>
                    </div>
                </div>
            `;
        }
        html += '</div>';
    }

    resultScore.innerHTML = html;
    resultPanel.style.display = 'block';
}

// Initialize test page
function initTestPage(dataFile, testType) {
    const rp = document.getElementById('result-panel');
    if (rp) rp.style.display = 'none';

    loadVocabularyData(dataFile, () => {
        generateCards(testType);
    });

    const submitBtn = document.getElementById('submit-btn');
    const refreshBtn = document.getElementById('refresh-btn');

    if (submitBtn) {
        submitBtn.removeEventListener('click', submitHandler);
        submitBtn.addEventListener('click', submitHandler);
    }
    if (refreshBtn) {
        refreshBtn.removeEventListener('click', refreshHandler);
        refreshBtn.addEventListener('click', refreshHandler);
    }

    function submitHandler() { checkAnswers(testType); }
    function refreshHandler() {
        if (rp) rp.style.display = 'none';
        generateCards(testType);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
