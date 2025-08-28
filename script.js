// Firebase SDK에서 필요한 함수들을 가져옵니다
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithRedirect,
    signInWithPopup,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-functions.js";

// 설정 상수
const CONFIG = {
    NOTION_CLIENT_ID: "259d872b-594c-80c7-9fd9-0037bc5be4d1",
    NOTION_REDIRECT_URI: "https://notiontamagotchi.netlify.app",
    RETRY_DELAY: 2000,
    MAX_RETRIES: 3,
    LOADING_TIMEOUT: 30000
};

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyDZZMSJG4sh9Vw-T7pjMztC2swkOg1i8os",
    authDomain: "notion-tamagotchi.firebaseapp.com",
    projectId: "notion-tamagotchi",
    storageBucket: "notion-tamagotchi.appspot.com",
    messagingSenderId: "128399204318",
    appId: "1:128399204318:web:197bf0d12b437b910f474f",
    measurementId: "G-02V3VDK4Q6"
};

// Firebase 앱 초기화 및 서비스 설정
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const functions = getFunctions(app, "asia-northeast3");

// HTML 요소 참조
const elements = {
    welcomeMessage: document.getElementById('welcomeMessage'),
    authButton: document.getElementById('authButton'),
    authStatus: document.getElementById('authStatus'),
    notionSection: document.getElementById('notionSection'),
    notionConnectButton: document.getElementById('notionConnectButton'),
    notionStatus: document.getElementById('notionStatus'),
    databaseSection: document.getElementById('databaseSection'),
    databaseSelect: document.getElementById('databaseSelect'),
    propertySelect: document.getElementById('propertySelect'),
    startButton: document.getElementById('startButton'),
    gameSection: document.getElementById('gameSection'),
    tamagotchiImage: document.getElementById('tamagotchiImage'),
    tamagotchiLevel: document.getElementById('tamagotchiLevel'),
    expDisplay: document.getElementById('expDisplay'),
    expBar: document.getElementById('expBar'),
    embedSection: document.getElementById('embedSection'),
    embedLinkInput: document.getElementById('embedLinkInput'),
    copyLinkButton: document.getElementById('copyLinkButton'),
    copyStatus: document.getElementById('copyStatus')
};

// 전역 상태
let tamagotchiStateUnsubscribe = null;
let currentRetryCount = 0;

// 유틸리티 함수들
const utils = {
    // 로딩 상태 표시
    showLoading: (element, originalText) => {
        element.disabled = true;
        element.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            로딩 중...
        `;
    },

    // 로딩 상태 해제
    hideLoading: (element, originalText) => {
        element.disabled = false;
        element.textContent = originalText;
    },

    // 에러 메시지 표시
    showError: (message, duration = 5000) => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, duration);
    },

    // 성공 메시지 표시
    showSuccess: (message, duration = 3000) => {
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, duration);
    },

    // 재시도 로직
    retry: async (fn, maxRetries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                console.warn(`재시도 ${i + 1}/${maxRetries}:`, error.message);
                
                if (i === maxRetries - 1) throw error;
                if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
};

// 인증 관련 함수들
const auth_functions = {
    signIn: () => {
        signInWithPopup(auth, provider).catch((error) => {
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
                signInWithRedirect(auth, provider).catch(handleAuthError);
            } else {
                handleAuthError(error);
            }
        });
    },

    logOut: () => {
        if (tamagotchiStateUnsubscribe) {
            tamagotchiStateUnsubscribe();
            tamagotchiStateUnsubscribe = null;
        }
        signOut(auth).catch((error) => {
            console.error("로그아웃 실패:", error);
            utils.showError("로그아웃 중 오류가 발생했습니다.");
        });
    }
};

// 에러 처리 함수
function handleAuthError(error) {
    console.error("인증 실패:", error);
    
    let errorMessage = "로그인 중 오류가 발생했습니다.";
    
    switch (error.code) {
        case 'auth/popup-blocked':
            errorMessage = "팝업이 차단되었습니다. 팝업을 허용해주세요.";
            break;
        case 'auth/network-request-failed':
            errorMessage = "네트워크 연결을 확인해주세요.";
            break;
        case 'auth/too-many-requests':
            errorMessage = "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
            break;
        default:
            errorMessage = error.message;
    }
    
    elements.authStatus.textContent = `오류: ${errorMessage}`;
    elements.authStatus.classList.remove('hidden');
    utils.showError(errorMessage);
}

// Notion 연동 함수들
const notion_functions = {
    connect: () => {
        const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${CONFIG.NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(CONFIG.NOTION_REDIRECT_URI)}`;
        window.location.href = authUrl;
    },

    handleCallback: async (user) => {
        if (!user) return;
        
        const urlParams = new URLSearchParams(window.location.search);
        const notionCode = urlParams.get('code');
        
        if (!notionCode) return;

        const originalText = elements.notionConnectButton.textContent;
        utils.showLoading(elements.notionConnectButton, originalText);
        
        // URL에서 code 파라미터 제거
        window.history.replaceState({}, document.title, window.location.pathname);
        
        try {
            const result = await utils.retry(async () => {
                const exchangeCodeForToken = httpsCallable(functions, 'exchangeCodeForToken');
                return await exchangeCodeForToken({ 
                    code: notionCode, 
                    redirectUri: CONFIG.NOTION_REDIRECT_URI 
                });
            });
            
            const tokenData = result.data;
            const tokenDocRef = doc(db, "users", user.uid, "notion", "token");
            await setDoc(tokenDocRef, tokenData);
            
            ui_functions.updateNotionUI(true);
            await database_functions.loadDatabases();
            utils.showSuccess("Notion 연동이 완료되었습니다!");
            
        } catch (error) {
            console.error("액세스 토큰 처리 실패:", error);
            
            let errorMessage = "토큰 처리에 실패했습니다.";
            if (error.code === 'functions/unauthenticated') {
                errorMessage = "인증이 만료되었습니다. 다시 로그인해주세요.";
            } else if (error.code === 'functions/internal') {
                errorMessage = "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            }
            
            elements.notionStatus.textContent = `오류: ${errorMessage}`;
            elements.notionStatus.className = "mt-2 text-sm text-red-600 font-semibold";
            elements.notionStatus.classList.remove('hidden');
            utils.showError(errorMessage);
            
        } finally {
            utils.hideLoading(elements.notionConnectButton, originalText);
        }
    }
};

// UI 업데이트 함수들
const ui_functions = {
    updateNotionUI: (isConnected) => {
        if (isConnected) {
            elements.notionConnectButton.textContent = 'Notion 재연동하기';
            elements.notionConnectButton.classList.remove('bg-gray-800', 'hover:bg-gray-900');
            elements.notionConnectButton.classList.add('bg-green-600', 'hover:bg-green-700');
            elements.notionStatus.textContent = '✅ Notion 연동 완료!';
            elements.notionStatus.className = "mt-2 text-sm text-green-600 font-semibold";
            elements.notionStatus.classList.remove('hidden');
            elements.databaseSection.classList.remove('hidden');
        }
    },

    updateAuthUI: (user) => {
        if (user) {
            elements.gameSection.classList.remove('hidden');
            elements.embedSection.classList.remove('hidden');
            elements.notionSection.classList.remove('hidden');
            elements.welcomeMessage.textContent = `${user.displayName}님, 환영합니다!`;
            elements.authButton.textContent = '로그아웃';
            elements.authStatus.classList.add('hidden');
            
            // 이벤트 리스너 설정
            elements.authButton.onclick = auth_functions.logOut;
            elements.notionConnectButton.onclick = notion_functions.connect;
            elements.databaseSelect.onchange = database_functions.loadProperties;
            elements.startButton.onclick = () => experience_functions.initialize(true);
            elements.copyLinkButton.onclick = ui_functions.copyEmbedLink;

            // 다마고치 상태 실시간 감지
            tamagotchi_functions.listenToState(user);
            
            // Notion 콜백 처리
            notion_functions.handleCallback(user);
            
            // 사용자 데이터 로드
            user_functions.loadData(user);
            
            // 임베딩 링크 설정
            const imageUrl = `https://asia-northeast3-notion-tamagotchi.cloudfunctions.net/serveTamagotchiImage?uid=${user.uid}`;
            elements.embedLinkInput.value = imageUrl;

        } else {
            elements.welcomeMessage.textContent = '로그인하여 다마고치를 키워보세요!';
            elements.authButton.textContent = '구글 계정으로 시작하기';
            elements.authStatus.classList.add('hidden');
            elements.authButton.onclick = auth_functions.signIn;
            
            // 숨김 처리
            ['gameSection', 'embedSection', 'notionSection', 'databaseSection'].forEach(sectionId => {
                elements[sectionId].classList.add('hidden');
            });
        }
    },

    copyEmbedLink: () => {
        const linkToCopy = elements.embedLinkInput.value;
        
        navigator.clipboard.writeText(linkToCopy).then(() => {
            elements.copyStatus.textContent = "✅ 복사 완료!";
            elements.copyStatus.className = "text-xs text-green-600 mt-1 h-4";
            setTimeout(() => { 
                elements.copyStatus.textContent = ""; 
            }, 2000);
        }).catch(err => {
            console.error('클립보드 복사 실패: ', err);
            elements.copyStatus.textContent = "복사에 실패했습니다.";
            elements.copyStatus.className = "text-xs text-red-600 mt-1 h-4";
        });
    }
};

// 사용자 데이터 관련 함수들
const user_functions = {
    loadData: async (user) => {
        if (!user) return;
        
        try {
            // Notion 토큰 확인
            const tokenDocRef = doc(db, "users", user.uid, "notion", "token");
            const tokenSnap = await getDoc(tokenDocRef);
            
            if (tokenSnap.exists()) {
                ui_functions.updateNotionUI(true);
                await database_functions.loadDatabases();
                
                // 저장된 설정 로드
                const settingsDocRef = doc(db, "users", user.uid, "settings", "config");
                const settingsSnap = await getDoc(settingsDocRef);
                
                if (settingsSnap.exists()) {
                    const { selectedDbId, propertyName } = settingsSnap.data();
                    elements.databaseSelect.value = selectedDbId;
                    await database_functions.loadProperties();
                    elements.propertySelect.value = propertyName;
                }
            }
        } catch (error) {
            console.error("사용자 데이터 로드 실패:", error);
            utils.showError("설정을 불러오는 중 오류가 발생했습니다.");
        }
    }
};

// 데이터베이스 관련 함수들
const database_functions = {
    loadDatabases: async () => {
        elements.databaseSelect.innerHTML = '<option>데이터베이스 목록을 불러오는 중...</option>';
        elements.databaseSelect.disabled = true;
        
        try {
            const result = await utils.retry(async () => {
                const getNotionDatabases = httpsCallable(functions, 'getNotionDatabases');
                return await getNotionDatabases();
            });
            
            const { databases } = result.data;
            
            if (databases && databases.length > 0) {
                elements.databaseSelect.innerHTML = '<option value="">-- 데이터베이스 선택 --</option>';
                databases.forEach(db => {
                    const option = document.createElement('option');
                    option.value = db.id;
                    option.textContent = db.title;
                    elements.databaseSelect.appendChild(option);
                });
                elements.databaseSelect.disabled = false;
            } else {
                elements.databaseSelect.innerHTML = '<option>공유된 데이터베이스가 없습니다.</option>';
                utils.showError("공유된 데이터베이스가 없습니다. Notion에서 데이터베이스를 공유해주세요.");
            }
        } catch (error) {
            console.error("데이터베이스 목록 로드 실패:", error);
            elements.databaseSelect.innerHTML = '<option>데이터베이스 로드 실패</option>';
            
            let errorMessage = "데이터베이스 목록을 불러올 수 없습니다.";
            if (error.code === 'functions/unauthenticated') {
                errorMessage = "Notion 연동이 만료되었습니다. 다시 연동해주세요.";
            }
            utils.showError(errorMessage);
        }
    },

    loadProperties: async () => {
        const selectedDbId = elements.databaseSelect.value;
        
        if (!selectedDbId) {
            elements.propertySelect.innerHTML = '<option>먼저 데이터베이스를 선택하세요.</option>';
            elements.propertySelect.disabled = true;
            elements.startButton.disabled = true;
            return;
        }

        elements.propertySelect.innerHTML = '<option>속성 목록 불러오는 중...</option>';
        elements.propertySelect.disabled = true;
        elements.startButton.disabled = true;

        try {
            const result = await utils.retry(async () => {
                const getDatabaseProperties = httpsCallable(functions, 'getDatabaseProperties');
                return await getDatabaseProperties({ databaseId: selectedDbId });
            });
            
            const { properties } = result.data;
            
            if (properties && properties.length > 0) {
                elements.propertySelect.innerHTML = '<option value="">-- 속성 선택 --</option>';
                properties.forEach(propName => {
                    const option = document.createElement('option');
                    option.value = propName;
                    option.textContent = propName;
                    elements.propertySelect.appendChild(option);
                });
                elements.propertySelect.disabled = false;
                elements.startButton.disabled = false;
            } else {
                elements.propertySelect.innerHTML = '<option>계산할 숫자/함수 속성이 없습니다.</option>';
                utils.showError("사용 가능한 숫자 또는 공식 속성이 없습니다.");
            }
        } catch (error) {
            console.error("속성 목록 로드 실패:", error);
            elements.propertySelect.innerHTML = '<option>속성 로드 실패</option>';
            utils.showError("속성 목록을 불러올 수 없습니다.");
        }
    }
};

// 경험치 관련 함수들
const experience_functions = {
    initialize: async (showAlert = true) => {
        const selectedDbId = elements.databaseSelect.value;
        const propertyName = elements.propertySelect.value;
        
        if (!selectedDbId || !propertyName) {
            utils.showError("데이터베이스와 속성을 모두 선택해주세요!");
            return;
        }
        
        const user = auth.currentUser;
        if (!user) {
            utils.showError("로그인이 필요합니다.");
            return;
        }

        // 설정 저장
        const settingsDocRef = doc(db, "users", user.uid, "settings", "config");
        await setDoc(settingsDocRef, { selectedDbId, propertyName });

        const originalText = elements.startButton.textContent;
        utils.showLoading(elements.startButton, originalText);

        try {
            await utils.retry(async () => {
                const initializeExperience = httpsCallable(functions, 'initializeExperience');
                return await initializeExperience({ 
                    databaseId: selectedDbId, 
                    propertyName: propertyName 
                });
            });
            
            if (showAlert) {
                utils.showSuccess("설정이 저장되었습니다! 이제 Notion에서 데이터베이스를 수정하면 자동으로 경험치가 업데이트됩니다.");
            }
            
        } catch (error) {
            console.error("초기 경험치 설정 실패:", error);
            
            let errorMessage = "초기화 중 오류가 발생했습니다.";
            if (error.code === 'functions/unauthenticated') {
                errorMessage = "Notion 연동이 만료되었습니다. 다시 연동해주세요.";
            } else if (error.code === 'functions/internal') {
                errorMessage = "서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            }
            
            utils.showError(errorMessage);
            
        } finally {
            utils.hideLoading(elements.startButton, originalText);
        }
    }
};

// 다마고치 관련 함수들
const tamagotchi_functions = {
    listenToState: (user) => {
        if (tamagotchiStateUnsubscribe) {
            tamagotchiStateUnsubscribe();
        }
        
        const stateDocRef = doc(db, "users", user.uid, "tamagotchi", "state");
        tamagotchiStateUnsubscribe = onSnapshot(stateDocRef, (docSnap) => {
            const totalExp = docSnap.exists() ? docSnap.data().totalExp || 0 : 0;
            tamagotchi_functions.updateVisuals(totalExp);
        }, (error) => {
            console.error("다마고치 상태 감지 오류:", error);
        });
    },

    updateVisuals: (exp) => {
        const { level, levelName, maxExp, color } = tamagotchi_functions.getDetailsByExp(exp);
        
        // 다마고치 이미지 업데이트 (실제 SVG 이미지 사용)
        const imageUrl = `https://asia-northeast3-notion-tamagotchi.cloudfunctions.net/serveTamagotchiImage?uid=${auth.currentUser?.uid}&t=${Date.now()}`;
        elements.tamagotchiImage.src = imageUrl;
        elements.tamagotchiImage.style.backgroundColor = color;
        
        elements.tamagotchiLevel.textContent = `Level ${level}: ${levelName}`;
        elements.expDisplay.textContent = exp;
        
        // 경험치 바 애니메이션
        const progressPercentage = Math.min((exp / maxExp) * 100, 100);
        elements.expBar.style.width = `${progressPercentage}%`;
        elements.expBar.style.backgroundColor = color;
        
        // 레벨업 효과 (선택적)
        if (exp > 0 && exp % 100 === 0) {
            tamagotchi_functions.showLevelUpEffect();
        }
    },

    getDetailsByExp: (exp) => {
        const levels = [
            { threshold: 0, level: 1, name: "알", maxExp: 100, color: "#A0AEC0" },
            { threshold: 1, level: 2, name: "새싹", maxExp: 100, color: "#84CC16" },
            { threshold: 100, level: 3, name: "유아기", maxExp: 400, color: "#14B8A6" },
            { threshold: 400, level: 4, name: "유년기1", maxExp: 900, color: "#F97316" },
            { threshold: 900, level: 5, name: "유년기2", maxExp: 1500, color: "#EC4899" },
            { threshold: 1500, level: 6, name: "성장기", maxExp: 2200, color: "#10B981" },
            { threshold: 2200, level: 7, name: "성숙기", maxExp: 3000, color: "#3B82F6" },
            { threshold: 3000, level: 8, name: "완전체", maxExp: 4000, color: "#8B5CF6" },
            { threshold: 4000, level: 9, name: "궁극체", maxExp: 5000, color: "#EF4444" },
            { threshold: 5000, level: 10, name: "전설", maxExp: 10000, color: "#F59E0B" }
        ];
        
        let currentLevel = levels[0];
        for (let i = levels.length - 1; i >= 0; i--) {
            if (exp >= levels[i].threshold) {
                currentLevel = levels[i];
                break;
            }
        }
        
        return {
            level: currentLevel.level,
            levelName: currentLevel.name,
            maxExp: currentLevel.maxExp,
            color: currentLevel.color
        };
    },

    showLevelUpEffect: () => {
        const effect = document.createElement('div');
        effect.className = 'fixed inset-0 flex items-center justify-center pointer-events-none z-50';
        effect.innerHTML = `
            <div class="bg-yellow-400 text-white px-8 py-4 rounded-lg shadow-lg text-2xl font-bold animate-bounce">
                🎉 레벨업! 🎉
            </div>
        `;
        document.body.appendChild(effect);
        
        setTimeout(() => {
            effect.remove();
        }, 3000);
    }
};

// 앱 초기화 및 메인 로직
const app_functions = {
    initialize: async () => {
        try {
            // Firebase 지속성 설정
            await setPersistence(auth, browserLocalPersistence);
            
            // 인증 상태 변경 감지
            onAuthStateChanged(auth, (user) => {
                ui_functions.updateAuthUI(user);
            });

            // 리다이렉트 결과 처리
            await getRedirectResult(auth);

        } catch (error) {
            handleAuthError(error);
        }
    }
};

// 앱 시작
app_functions.initialize();
