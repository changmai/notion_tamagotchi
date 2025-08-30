// 기존 script.js를 기반으로 햄버거 메뉴 기능만 추가
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const functions = getFunctions(app, "asia-northeast3");

// HTML 요소 참조 (기존 + 햄버거 메뉴 + 새로운 버튼들)
const elements = {
    // 기존 요소들
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
    copyStatus: document.getElementById('copyStatus'),
    
    // 햄버거 메뉴 요소들
    hamburgerButton: document.getElementById('hamburgerButton'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    closeSidebar: document.getElementById('closeSidebar'),
    initialScreen: document.getElementById('initialScreen'),
    loginSection: document.getElementById('loginSection'),
    userInfo: document.getElementById('userInfo'),
    userDisplayName: document.getElementById('userDisplayName'),
    userInitial: document.getElementById('userInitial'),
    logoutButton: document.getElementById('logoutButton'),
    settingsContainer: document.getElementById('settingsContainer'),
    
    // 통계 및 버튼 요소들
    totalPages: document.getElementById('totalPages'),
    refreshButton: document.getElementById('refreshButton'),
    shareButton: document.getElementById('shareButton'),
    
    // 건강 상태 요소들
    healthIcon: document.getElementById('healthIcon'),
    healthStatus: document.getElementById('healthStatus'),
    healthMessage: document.getElementById('healthMessage'),
    lastUpdateDays: document.getElementById('lastUpdateDays')
};

// 전역 상태
let tamagotchiStateUnsubscribe = null;
let currentRetryCount = 0;
let sidebarOpen = false;
// ▼▼▼▼▼ 3. 코드 효율성: 불필요한 요청 감소를 위한 변수 ▼▼▼▼▼
let currentTamagotchiLevel = -1;
// ▲▲▲▲▲ 변경점 ▲▲▲▲▲

// 유틸리티 함수들 (기존 유지)
const utils = {
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

    hideLoading: (element, originalText) => {
        element.disabled = false;
        element.textContent = originalText;
    },

    showError: (message, duration = 5000) => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, duration);
    },

    showSuccess: (message, duration = 3000) => {
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, duration);
    },

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
    },

    getUserInitial: (displayName) => {
        return displayName ? displayName.charAt(0).toUpperCase() : 'U';
    }
};

// 사이드바 관리 (햄버거 메뉴)
const sidebar = {
    open: () => {
        if (!elements.hamburgerButton || !elements.sidebar) return;
        sidebarOpen = true;
        elements.hamburgerButton.classList.add('hamburger-open');
        elements.sidebar.classList.add('open');
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.remove('opacity-0', 'pointer-events-none');
            elements.sidebarOverlay.classList.add('opacity-100');
        }
        document.body.style.overflow = 'hidden';
    },

    close: () => {
        if (!elements.hamburgerButton || !elements.sidebar) return;
        sidebarOpen = false;
        elements.hamburgerButton.classList.remove('hamburger-open');
        elements.sidebar.classList.remove('open');
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.add('opacity-0', 'pointer-events-none');
            elements.sidebarOverlay.classList.remove('opacity-100');
        }
        document.body.style.overflow = '';
    },

    toggle: () => {
        if (sidebarOpen) {
            sidebar.close();
        } else {
            sidebar.open();
        }
    }
};

// 기존 함수들 유지
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
    
    if (elements.authStatus) {
        elements.authStatus.textContent = `오류: ${errorMessage}`;
        elements.authStatus.classList.remove('hidden');
    }
    utils.showError(errorMessage);
}

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
            
            if (elements.notionStatus) {
                elements.notionStatus.textContent = `오류: ${errorMessage}`;
                elements.notionStatus.className = "mt-2 text-sm text-red-600 font-semibold";
                elements.notionStatus.classList.remove('hidden');
            }
            utils.showError(errorMessage);
            
        } finally {
            utils.hideLoading(elements.notionConnectButton, originalText);
        }
    }
};

const ui_functions = {
    updateNotionUI: (isConnected) => {
        if (isConnected && elements.notionConnectButton && elements.notionStatus) {
            elements.notionConnectButton.textContent = 'Notion 재연동하기';
            elements.notionConnectButton.classList.remove('bg-gray-800', 'hover:bg-gray-900');
            elements.notionConnectButton.classList.add('bg-green-600', 'hover:bg-green-700');
            elements.notionStatus.textContent = '✅ Notion 연동 완료!';
            elements.notionStatus.className = "mt-2 text-sm text-green-600 font-semibold";
            elements.notionStatus.classList.remove('hidden');
            if (elements.databaseSection) {
                elements.databaseSection.classList.remove('hidden');
            }
        }
    },

    updateAuthUI: (user) => {
        if (user) {
            // 햄버거 메뉴가 있는 경우
            if (elements.initialScreen && elements.loginSection && elements.userInfo) {
                elements.initialScreen.classList.add('hidden');
                elements.loginSection.classList.add('hidden');
                elements.userInfo.classList.remove('hidden');
                elements.settingsContainer?.classList.remove('hidden');
                
                if (elements.userDisplayName) {
                    elements.userDisplayName.textContent = user.displayName || '사용자';
                }
                if (elements.userInitial) {
                    elements.userInitial.textContent = utils.getUserInitial(user.displayName);
                }
                if (elements.logoutButton) {
                    elements.logoutButton.onclick = auth_functions.logOut;
                }
            } else {
                // 기존 방식 (햄버거 메뉴가 없는 경우)
                if (elements.welcomeMessage) {
                    elements.welcomeMessage.textContent = `${user.displayName}님, 환영합니다!`;
                }
                if (elements.authButton) {
                    elements.authButton.textContent = '로그아웃';
                    elements.authButton.onclick = auth_functions.logOut;
                }
            }
            
            // 공통 처리
            if (elements.gameSection) elements.gameSection.classList.remove('hidden');
            if (elements.embedSection) elements.embedSection.classList.remove('hidden');
            if (elements.notionSection) elements.notionSection.classList.remove('hidden');
            if (elements.authStatus) elements.authStatus.classList.add('hidden');
            
            // 이벤트 리스너 설정
            if (elements.notionConnectButton) {
                elements.notionConnectButton.onclick = notion_functions.connect;
            }
            if (elements.databaseSelect) {
                elements.databaseSelect.onchange = database_functions.loadProperties;
            }
            if (elements.startButton) {
                elements.startButton.onclick = () => experience_functions.initialize(true);
            }
            if (elements.copyLinkButton) {
                elements.copyLinkButton.onclick = ui_functions.copyEmbedLink;
            }
            
            // 새로 추가된 버튼들
            if (elements.refreshButton) {
                elements.refreshButton.onclick = ui_functions.refreshData;
            }
            if (elements.shareButton) {
                elements.shareButton.onclick = ui_functions.shareApp;
            }

            // 다마고치 상태 실시간 감지
            tamagotchi_functions.listenToState(user);
            
            // Notion 콜백 처리
            notion_functions.handleCallback(user);
            
            // 사용자 데이터 로드
            user_functions.loadData(user);
            
            // 임베딩 링크 설정
            if (elements.embedLinkInput) {
                const imageUrl = `https://asia-northeast3-notion-tamagotchi.cloudfunctions.net/serveTamagotchiImage?uid=${user.uid}`;
                elements.embedLinkInput.value = imageUrl;
            }

        } else {
            // 로그아웃 상태
            if (elements.initialScreen && elements.loginSection && elements.userInfo) {
                elements.initialScreen.classList.remove('hidden');
                elements.loginSection.classList.remove('hidden');
                elements.userInfo.classList.add('hidden');
                elements.settingsContainer?.classList.add('hidden');
                
                if (elements.authButton) {
                    elements.authButton.onclick = auth_functions.signIn;
                }

            } else {
                if (elements.welcomeMessage) {
                    elements.welcomeMessage.textContent = '로그인하여 다마고치를 키워보세요!';
                }
                if (elements.authButton) {
                    elements.authButton.textContent = '구글 계정으로 시작하기';
                    elements.authButton.onclick = auth_functions.signIn;
                }
            }
            
            // 공통 처리
            if (elements.gameSection) elements.gameSection.classList.add('hidden');
            if (elements.embedSection) elements.embedSection.classList.add('hidden');
            if (elements.notionSection) elements.notionSection.classList.add('hidden');
            if (elements.databaseSection) elements.databaseSection.classList.add('hidden');
            if (elements.authStatus) elements.authStatus.classList.add('hidden');
        }
    },

    copyEmbedLink: () => {
        if (!elements.embedLinkInput) return;
        
        const linkToCopy = elements.embedLinkInput.value;
        
        navigator.clipboard.writeText(linkToCopy).then(() => {
            if (elements.copyStatus) {
                elements.copyStatus.textContent = "✅ 복사 완료!";
                elements.copyStatus.className = "text-xs text-green-600 mt-1 h-4";
                setTimeout(() => { 
                    elements.copyStatus.textContent = ""; 
                }, 2000);
            }
        }).catch(err => {
            console.error('클립보드 복사 실패: ', err);
            if (elements.copyStatus) {
                elements.copyStatus.textContent = "복사에 실패했습니다.";
                elements.copyStatus.className = "text-xs text-red-600 mt-1 h-4";
            }
        });
    },

    // 새로고침 버튼 기능
    refreshData: async () => {
        const user = auth.currentUser;
        if (!user) return;

        const originalText = elements.refreshButton.textContent;
        elements.refreshButton.innerHTML = `
            <svg class="animate-spin w-4 h-4 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            새로고침
        `;
        elements.refreshButton.disabled = true;

        try {
            // 경험치 강제 재계산
            const settingsDocRef = doc(db, "users", user.uid, "settings", "config");
            const settingsSnap = await getDoc(settingsDocRef);
            
            if (settingsSnap.exists()) {
                const { selectedDbId, propertyName } = settingsSnap.data();
                
                const initializeExperience = httpsCallable(functions, 'initializeExperience');
                await initializeExperience({ 
                    databaseId: selectedDbId, 
                    propertyName: propertyName 
                });
                
                utils.showSuccess("데이터가 새로고침되었습니다!");
            } else {
                utils.showError("설정을 먼저 완료해주세요.");
            }
        } catch (error) {
            console.error("새로고침 실패:", error);
            utils.showError("새로고침 중 오류가 발생했습니다.");
        } finally {
            elements.refreshButton.textContent = originalText;
            elements.refreshButton.disabled = false;
        }
    },

    // 공유 버튼 기능 (개선된 버전)
    shareApp: async () => {
        const user = auth.currentUser;
        if (!user) return;

        const shareButton = elements.shareButton;
        const originalContent = shareButton.innerHTML;
        
        const shareData = {
            title: 'Notion 다마고치',
            text: 'Notion으로 다마고치를 키하며 생산성을 높여보세요!',
            url: window.location.href
        };

        // 로딩 상태 UI로 변경
        shareButton.disabled = true;
        shareButton.innerHTML = `
            <svg class="animate-spin w-4 h-4 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            ${navigator.share ? '공유...' : '복사 중...'}
        `;

        try {
            if (navigator.share) {
                // 모바일: Web Share API 사용
                await navigator.share(shareData);
            } else {
                // PC: 클립보드에 복사
                await navigator.clipboard.writeText(shareData.url);
                utils.showSuccess("링크가 클립보드에 복사되었습니다!");
            }
        } catch (error) {
            // 사용자가 공유를 취소한 경우는 오류로 처리하지 않음
            if (error.name !== 'AbortError') {
                console.error('공유 또는 복사 실패:', error);
                utils.showError("작업에 실패했습니다. 다시 시도해주세요.");
            }
        } finally {
            // 버튼을 원래 상태로 복원
            shareButton.disabled = false;
            shareButton.innerHTML = originalContent;
        }
    },

    // 통계 업데이트
    updateStatistics: (totalExp, pageCount) => {
        if (elements.totalPages) {
            elements.totalPages.textContent = pageCount || 0;
        }
    }
};

// 기존 함수들 유지
const user_functions = {
    loadData: async (user) => {
        if (!user) return;
        
        try {
            const tokenDocRef = doc(db, "users", user.uid, "notion", "token");
            const tokenSnap = await getDoc(tokenDocRef);
            
            if (tokenSnap.exists()) {
                ui_functions.updateNotionUI(true);
                await database_functions.loadDatabases();
                
                // 기존과 동일한 경로 사용
                const settingsDocRef = doc(db, "users", user.uid, "settings", "config");
                const settingsSnap = await getDoc(settingsDocRef);
                
                if (settingsSnap.exists()) {
                    const { selectedDbId, propertyName } = settingsSnap.data();
                    if (elements.databaseSelect) elements.databaseSelect.value = selectedDbId;
                    await database_functions.loadProperties();
                    if (elements.propertySelect) elements.propertySelect.value = propertyName;
                }
            }
        } catch (error) {
            console.error("사용자 데이터 로드 실패:", error);
            utils.showError("설정을 불러오는 중 오류가 발생했습니다.");
        }
    }
};

const database_functions = {
    loadDatabases: async () => {
        if (!elements.databaseSelect) return;
        
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
        if (!elements.databaseSelect || !elements.propertySelect || !elements.startButton) return;
        
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

const experience_functions = {
    initialize: async (showAlert = true) => {
        if (!elements.databaseSelect || !elements.propertySelect || !elements.startButton) return;
        
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

        // 기존과 동일한 경로 사용
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
                // 설정 완료 후 사이드바 닫기
                setTimeout(() => {
                    sidebar.close();
                }, 1000);
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

const tamagotchi_functions = {
    listenToState: (user) => {
        if (tamagotchiStateUnsubscribe) {
            tamagotchiStateUnsubscribe();
        }
        
        const stateDocRef = doc(db, "users", user.uid, "tamagotchi", "state");
        tamagotchiStateUnsubscribe = onSnapshot(stateDocRef, (docSnap) => {
            const data = docSnap.exists() ? docSnap.data() : {};
            const totalExp = data.totalExp || 0;
            const pageCount = data.pageCount || 0;
            const lastUpdated = data.lastUpdated || null;
            
            tamagotchi_functions.updateVisuals(totalExp);
            ui_functions.updateStatistics(totalExp, pageCount);
            
            // ▼▼▼▼▼ 2. 사용자 경험(UX): 건강 상태 업데이트 함수 호출 ▼▼▼▼▼
            tamagotchi_functions.updateHealthStatus(lastUpdated);
            // ▲▲▲▲▲ 변경점 ▲▲▲▲▲
        }, (error) => {
            console.error("다마고치 상태 감지 오류:", error);
        });
    },

    updateVisuals: (exp) => {
        const { level, levelName, maxExp, color } = tamagotchi_functions.getDetailsByExp(exp);
        
        // ▼▼▼▼▼ 3. 코드 효율성: 레벨 변경 시에만 이미지 새로고침 ▼▼▼▼▼
        if (elements.tamagotchiImage) {
            if (level !== currentTamagotchiLevel) {
                currentTamagotchiLevel = level;
                // 캐시 방지를 위해 level을 파라미터로 추가하여 URL 변경
                const imageUrl = `https://asia-northeast3-notion-tamagotchi.cloudfunctions.net/serveTamagotchiImage?uid=${auth.currentUser?.uid}&v=${level}`;
                elements.tamagotchiImage.src = imageUrl;
            }
            elements.tamagotchiImage.style.backgroundColor = color;
        }
        // ▲▲▲▲▲ 변경점 ▲▲▲▲▲
        
        if (elements.tamagotchiLevel) {
            elements.tamagotchiLevel.textContent = `Level ${level}: ${levelName}`;
        }
        
        if (elements.expDisplay) {
            elements.expDisplay.textContent = exp;
        }
        
        if (elements.expBar) {
            const progressPercentage = Math.min((exp / maxExp) * 100, 100);
            elements.expBar.style.width = `${progressPercentage}%`;
            elements.expBar.style.backgroundColor = color;
        }
        
        // 레벨업 효과
        if (exp > 0 && exp % 100 === 0) {
            tamagotchi_functions.showLevelUpEffect();
        }
    },

    // ▼▼▼▼▼ 2. 사용자 경험(UX): 건강 상태 업데이트 함수 추가 ▼▼▼▼▼
    updateHealthStatus: (lastUpdated) => {
        if (!lastUpdated || !elements.healthStatus) return;

        const now = new Date();
        const lastUpdateDate = lastUpdated.toDate();
        const diffHours = (now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60);
        const diffDays = Math.floor(diffHours / 24);
    
        let status, message, icon, colorClass;
    
        if (diffHours < 24) {
            status = "활발함";
            message = "다마고치가 아주 건강해요!";
            icon = "💚";
            colorClass = "text-green-600";
        } else if (diffHours < 72) {
            status = "평범함";
            message = `최근 활동이 없었어요. ${diffDays}일 동안 업데이트가 없네요.`;
            icon = "💛";
            colorClass = "text-yellow-500";
        } else {
            status = "아픔";
            message = `오랫동안 돌보지 않아 아파요... ${diffDays}일 동안 업데이트가 없네요.`;
            icon = "💔";
            colorClass = "text-red-500";
        }
    
        elements.healthStatus.textContent = status;
        elements.healthStatus.className = `text-sm font-bold ${colorClass}`;
        elements.healthMessage.textContent = message;
        elements.healthIcon.textContent = icon;
        
        if (diffDays >= 1) {
            elements.lastUpdateDays.textContent = `${diffDays}일 전`;
        } else if (diffHours >= 1) {
            elements.lastUpdateDays.textContent = `${Math.floor(diffHours)}시간 전`;
        } else {
            elements.lastUpdateDays.textContent = "방금 전";
        }
    },
    // ▲▲▲▲▲ 변경점 ▲▲▲▲▲

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
                레벨업! 🎉
            </div>
        `;
        document.body.appendChild(effect);
        
        setTimeout(() => {
            effect.remove();
        }, 3000);
    }
};

// 이벤트 리스너 설정
function setupEventListeners() {
    // 햄버거 메뉴 이벤트
    if (elements.hamburgerButton) {
        elements.hamburgerButton.addEventListener('click', sidebar.toggle);
    }
    if (elements.closeSidebar) {
        elements.closeSidebar.addEventListener('click', sidebar.close);
    }
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', sidebar.close);
    }
    
    // ESC 키로 사이드바 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarOpen) {
            sidebar.close();
        }
    });
}

// 앱 초기화
const app_functions = {
    initialize: async () => {
        try {
            // Firebase 지속성 설정
            await setPersistence(auth, browserLocalPersistence);
            
            // 이벤트 리스너 설정
            setupEventListeners();
            
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
