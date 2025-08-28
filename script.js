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
    // 햄버거 메뉴 관련
    hamburgerButton: document.getElementById('hamburgerButton'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    closeSidebar: document.getElementById('closeSidebar'),
    
    // 화면 전환 관련
    initialScreen: document.getElementById('initialScreen'),
    gameSection: document.getElementById('gameSection'),
    
    // 사용자 정보
    loginSection: document.getElementById('loginSection'),
    userInfo: document.getElementById('userInfo'),
    userDisplayName: document.getElementById('userDisplayName'),
    userInitial: document.getElementById('userInitial'),
    welcomeMessage: document.getElementById('welcomeMessage'),
    authButton: document.getElementById('authButton'),
    logoutButton: document.getElementById('logoutButton'),
    authStatus: document.getElementById('authStatus'),
    settingsContainer: document.getElementById('settingsContainer'),
    
    // Notion 연동
    notionConnectButton: document.getElementById('notionConnectButton'),
    notionStatus: document.getElementById('notionStatus'),
    databaseSection: document.getElementById('databaseSection'),
    databaseSelect: document.getElementById('databaseSelect'),
    propertySelect: document.getElementById('propertySelect'),
    startButton: document.getElementById('startButton'),
    
    // 다마고치 관련
    tamagotchiImage: document.getElementById('tamagotchiImage'),
    tamagotchiLevel: document.getElementById('tamagotchiLevel'),
    expDisplay: document.getElementById('expDisplay'),
    expBar: document.getElementById('expBar'),
    
    // 통계 및 액션
    totalPages: document.getElementById('totalPages'),
    todayExp: document.getElementById('todayExp'),
    currentStreak: document.getElementById('currentStreak'),
    refreshButton: document.getElementById('refreshButton'),
    shareButton: document.getElementById('shareButton'),
    
    // 임베딩
    embedSection: document.getElementById('embedSection'),
    embedLinkInput: document.getElementById('embedLinkInput'),
    copyLinkButton: document.getElementById('copyLinkButton'),
    copyStatus: document.getElementById('copyStatus')
};

// 전역 상태
let tamagotchiStateUnsubscribe = null;
let currentUser = null;
let sidebarOpen = false;

// 유틸리티 함수들
const utils = {
    // 로딩 상태 표시
    showLoading: (element, originalText) => {
        element.disabled = true;
        element.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

    // 토스트 메시지 표시
    showToast: (message, type = 'info', duration = 3000) => {
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };

        const toast = document.createElement('div');
        toast.className = `fixed top-6 right-6 ${colors[type]} text-white px-6 py-3 rounded-xl shadow-lg z-50 toast-enter`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
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
    },

    // 사용자 이니셜 생성
    getUserInitial: (displayName) => {
        return displayName ? displayName.charAt(0).toUpperCase() : 'U';
    }
};

// 사이드바 관리 함수들
const sidebar = {
    open: () => {
        sidebarOpen = true;
        elements.hamburgerButton.classList.add('hamburger-open');
        elements.sidebar.classList.add('open');
        elements.sidebarOverlay.classList.remove('opacity-0', 'pointer-events-none');
        elements.sidebarOverlay.classList.add('opacity-100');
        document.body.style.overflow = 'hidden';
    },

    close: () => {
        sidebarOpen = false;
        elements.hamburgerButton.classList.remove('hamburger-open');
        elements.sidebar.classList.remove('open');
        elements.sidebarOverlay.classList.add('opacity-0', 'pointer-events-none');
        elements.sidebarOverlay.classList.remove('opacity-100');
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
            utils.showToast("로그아웃 중 오류가 발생했습니다.", 'error');
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
    utils.showToast(errorMessage, 'error');
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
            utils.showToast("Notion 연동이 완료되었습니다!", 'success');
            
        } catch (error) {
            console.error("액세스 토큰 처리 실패:", error);
            
            let errorMessage = "토큰 처리에 실패했습니다.";
            if (error.code === 'functions/unauthenticated') {
                errorMessage = "인증이 만료되었습니다. 다시 로그인해주세요.";
            } else if (error.code === 'functions/internal') {
                errorMessage = "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            }
            
            elements.notionStatus.textContent = `오류: ${errorMessage}`;
            elements.notionStatus.className = "mt-2 text-xs text-red-600 font-semibold";
            elements.notionStatus.classList.remove('hidden');
            utils.showToast(errorMessage, 'error');
            
        } finally {
            utils.hideLoading(elements.notionConnectButton, originalText);
        }
    }
};

// UI 업데이트 함수들
const ui_functions = {
    updateAuthUI: (user) => {
        currentUser = user;
        
        if (user) {
            // 사용자 로그인 상태
            elements.initialScreen.classList.add('hidden');
            elements.gameSection.classList.remove('hidden');
            elements.loginSection.classList.add('hidden');
            elements.userInfo.classList.remove('hidden');
            elements.settingsContainer.classList.remove('hidden');
            
            // 사용자 정보 업데이트
            elements.userDisplayName.textContent = user.displayName || '사용자';
            elements.userInitial.textContent = utils.getUserInitial(user.displayName);
            
            // 이벤트 리스너 설정
            elements.logoutButton.onclick = auth_functions.logOut;
            elements.notionConnectButton.onclick = notion_functions.connect;
            elements.databaseSelect.onchange = database_functions.loadProperties;
            elements.startButton.onclick = () => experience_functions.initialize(true);
            elements.copyLinkButton.onclick = ui_functions.copyEmbedLink;
            elements.refreshButton.onclick = ui_functions.refreshData;
            elements.shareButton.onclick = ui_functions.shareImage;

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
            // 로그아웃 상태
            elements.initialScreen.classList.remove('hidden');
            elements.gameSection.classList.add('hidden');
            elements.loginSection.classList.remove('hidden');
            elements.userInfo.classList.add('hidden');
            elements.settingsContainer.classList.add('hidden');
            
            elements.welcomeMessage.textContent = '로그인이 필요합니다';
            elements.authButton.onclick = auth_functions.signIn;
        }
    },

    updateNotionUI: (isConnected) => {
        if (isConnected) {
            elements.notionConnectButton.textContent = 'Notion 재연동하기';
            elements.notionConnectButton.classList.remove('bg-gray-800', 'hover:bg-gray-900');
            elements.notionConnectButton.classList.add('bg-green-600', 'hover:bg-green-700');
            elements.notionStatus.textContent = '연동 완료!';
            elements.notionStatus.className = "mt-2 text-xs text-green-600 font-semibold flex items-center";
            elements.notionStatus.classList.remove('hidden');
            elements.databaseSection.classList.remove('hidden');
            elements.embedSection.classList.remove('hidden');
        }
    },

    copyEmbedLink: () => {
        const linkToCopy = elements.embedLinkInput.value;
        
        navigator.clipboard.writeText(linkToCopy).then(() => {
            elements.copyStatus.textContent = "복사 완료!";
            elements.copyStatus.className = "text-xs text-green-600 mt-2";
            utils.showToast("링크가 복사되었습니다!", 'success');
            setTimeout(() => { 
                elements.copyStatus.textContent = ""; 
            }, 2000);
        }).catch(err => {
            console.error('클립보드 복사 실패: ', err);
            elements.copyStatus.textContent = "복사 실패";
            elements.copyStatus.className = "text-xs text-red-600 mt-2";
            utils.showToast("복사에 실패했습니다.", 'error');
        });
    },

    refreshData: async () => {
        if (!currentUser) return;
        
        const originalText = elements.refreshButton.textContent;
        utils.showLoading(elements.refreshButton, originalText);
        
        try {
            // 강제로 다마고치 이미지 새로고침
            const imageUrl = `https://asia-northeast3-notion-tamagotchi.cloudfunctions.net/serveTamagotchiImage?uid=${currentUser.uid}&t=${Date.now()}`;
            elements.tamagotchiImage.src = imageUrl;
            
            utils.showToast("데이터가 새로고침되었습니다!", 'success');
        } catch (error) {
            console.error("새로고침 실패:", error);
            utils.showToast("새로고침에 실패했습니다.", 'error');
        } finally {
            utils.hideLoading(elements.refreshButton, originalText);
        }
    },

    // 개선된 공유 함수
shareImage: async () => {
    if (!currentUser) return;
    
    try {
        const appUrl = window.location.origin; // 앱 URL
        const imageUrl = `https://asia-northeast3-notion-tamagotchi.cloudfunctions.net/serveTamagotchiImage?uid=${currentUser.uid}`;
        
        // 현재 다마고치 정보 가져오기
        const stateDocRef = doc(db, "users", currentUser.uid, "tamagotchi", "state");
        const stateSnap = await getDoc(stateDocRef);
        const totalExp = stateSnap.exists() ? stateSnap.data().totalExp || 0 : 0;
        const { level, levelName } = tamagotchi_functions.getDetailsByExp(totalExp);
        
        const shareData = {
            title: `내 Notion 다마고치 - Level ${level}: ${levelName}`,
            text: `내 다마고치가 Level ${level} (${levelName})까지 성장했어요! 경험치: ${totalExp} EXP`,
            url: appUrl // 앱 자체 URL로 공유
        };

        // Web Share API 지원 여부 확인 및 실행
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
            utils.showToast("공유되었습니다!", 'success');
        } else {
            // 폴백: 공유 옵션 모달 표시
            showShareModal(shareData, imageUrl);
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            // 사용자가 공유를 취소한 경우 (정상적인 동작)
            return;
        }
        console.error("공유 실패:", error);
        
        // 폴백: 클립보드에 텍스트 복사
        try {
            const shareText = `내 다마고치가 Level ${level} (${levelName})까지 성장했어요! ${appUrl}`;
            await navigator.clipboard.writeText(shareText);
            utils.showToast("공유 텍스트가 복사되었습니다!", 'success');
        } catch (clipboardError) {
            utils.showToast("공유에 실패했습니다.", 'error');
        }
    }
},

// 공유 모달 표시 함수 (폴백용)
showShareModal: (shareData, imageUrl) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 class="text-lg font-bold text-gray-800 mb-4 text-center">다마고치 공유하기</h3>
            
            <div class="space-y-3">
                <!-- 텍스트 복사 -->
                <button onclick="copyShareText()" class="w-full flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-xl transition">
                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                    </svg>
                    텍스트 복사
                </button>
                
                <!-- 이미지 링크 복사 -->
                <button onclick="copyImageLink()" class="w-full flex items-center justify-center bg-purple-500 hover:bg-purple-600 text-white py-3 px-4 rounded-xl transition">
                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                    </svg>
                    이미지 링크 복사
                </button>
                
                <!-- 카카오톡 공유 (만약 지원한다면) -->
                <button onclick="shareToKakao()" class="w-full flex items-center justify-center bg-yellow-400 hover:bg-yellow-500 text-gray-800 py-3 px-4 rounded-xl transition">
                    <span class="mr-2">💬</span>
                    카카오톡 공유
                </button>
            </div>
            
            <button onclick="closeModal()" class="w-full mt-4 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-xl transition">
                닫기
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 모달 내부 함수들
    window.copyShareText = async () => {
        try {
            await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
            utils.showToast("공유 텍스트가 복사되었습니다!", 'success');
            closeModal();
        } catch (error) {
            utils.showToast("복사에 실패했습니다.", 'error');
        }
    };
    
    window.copyImageLink = async () => {
        try {
            await navigator.clipboard.writeText(imageUrl);
            utils.showToast("이미지 링크가 복사되었습니다!", 'success');
            closeModal();
        } catch (error) {
            utils.showToast("복사에 실패했습니다.", 'error');
        }
    };
    
    window.shareToKakao = () => {
        // 카카오톡 공유 API 호출 (카카오 SDK 필요)
        utils.showToast("카카오톡 공유는 준비 중입니다.", 'info');
    };
    
    window.closeModal = () => {
        modal.remove();
        // 전역 함수들 정리
        delete window.copyShareText;
        delete window.copyImageLink;
        delete window.shareToKakao;
        delete window.closeModal;
    };
    
    // 모달 외부 클릭시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// 사용자 데이터 관련 함수들
const user_functions = {
    loadData: async (user) => {
        if (!user) return;
        
        try {
            const tokenDocRef = doc(db, "users", user.uid, "notion", "token");
            const tokenSnap = await getDoc(tokenDocRef);
            
            if (tokenSnap.exists()) {
                ui_functions.updateNotionUI(true);
                await database_functions.loadDatabases();
                
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
            utils.showToast("설정을 불러오는 중 오류가 발생했습니다.", 'error');
        }
    }
};

// 데이터베이스 관련 함수들
const database_functions = {
    loadDatabases: async () => {
        elements.databaseSelect.innerHTML = '<option>목록 불러오는 중...</option>';
        elements.databaseSelect.disabled = true;
        
        try {
            const result = await utils.retry(async () => {
                const getNotionDatabases = httpsCallable(functions, 'getNotionDatabases');
                return await getNotionDatabases();
            });
            
            const { databases } = result.data;
            
            if (databases && databases.length > 0) {
                elements.databaseSelect.innerHTML = '<option value="">-- 선택 --</option>';
                databases.forEach(db => {
                    const option = document.createElement('option');
                    option.value = db.id;
                    option.textContent = db.title;
                    elements.databaseSelect.appendChild(option);
                });
                elements.databaseSelect.disabled = false;
            } else {
                elements.databaseSelect.innerHTML = '<option>공유된 DB 없음</option>';
                utils.showToast("공유된 데이터베이스가 없습니다.", 'warning');
            }
        } catch (error) {
            console.error("데이터베이스 목록 로드 실패:", error);
            elements.databaseSelect.innerHTML = '<option>로드 실패</option>';
            
            let errorMessage = "데이터베이스 목록을 불러올 수 없습니다.";
            if (error.code === 'functions/unauthenticated') {
                errorMessage = "Notion 연동이 만료되었습니다.";
            }
            utils.showToast(errorMessage, 'error');
        }
    },

    loadProperties: async () => {
        const selectedDbId = elements.databaseSelect.value;
        
        if (!selectedDbId) {
            elements.propertySelect.innerHTML = '<option>먼저 데이터베이스를 선택하세요</option>';
            elements.propertySelect.disabled = true;
            elements.startButton.disabled = true;
            return;
        }

        elements.propertySelect.innerHTML = '<option>속성 로딩 중...</option>';
        elements.propertySelect.disabled = true;
        elements.startButton.disabled = true;

        try {
            const result = await utils.retry(async () => {
                const getDatabaseProperties = httpsCallable(functions, 'getDatabaseProperties');
                return await getDatabaseProperties({ databaseId: selectedDbId });
            });
            
            const { properties } = result.data;
            
            if (properties && properties.length > 0) {
                elements.propertySelect.innerHTML = '<option value="">-- 선택 --</option>';
                properties.forEach(propName => {
                    const option = document.createElement('option');
                    option.value = propName;
                    option.textContent = propName;
                    elements.propertySelect.appendChild(option);
                });
                elements.propertySelect.disabled = false;
                elements.startButton.disabled = false;
            } else {
                elements.propertySelect.innerHTML = '<option>숫자/공식 속성 없음</option>';
                utils.showToast("사용 가능한 속성이 없습니다.", 'warning');
            }
        } catch (error) {
            console.error("속성 목록 로드 실패:", error);
            elements.propertySelect.innerHTML = '<option>로드 실패</option>';
            utils.showToast("속성 목록을 불러올 수 없습니다.", 'error');
        }
    }
};

// 경험치 관련 함수들
const experience_functions = {
    initialize: async (showToast = true) => {
        const selectedDbId = elements.databaseSelect.value;
        const propertyName = elements.propertySelect.value;
        
        if (!selectedDbId || !propertyName) {
            utils.showToast("데이터베이스와 속성을 선택해주세요!", 'warning');
            return;
        }
        
        const user = auth.currentUser;
        if (!user) {
            utils.showToast("로그인이 필요합니다.", 'error');
            return;
        }

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
            
            if (showToast) {
                utils.showToast("설정이 저장되었습니다!", 'success');
                sidebar.close(); // 설정 완료 후 사이드바 닫기
            }
            
        } catch (error) {
            console.error("초기 경험치 설정 실패:", error);
            
            let errorMessage = "초기화 중 오류가 발생했습니다.";
            if (error.code === 'functions/unauthenticated') {
                errorMessage = "Notion 연동이 만료되었습니다.";
            } else if (error.code === 'functions/internal') {
                errorMessage = "서버에서 오류가 발생했습니다.";
            }
            
            utils.showToast(errorMessage, 'error');
            
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
            const data = docSnap.exists() ? docSnap.data() : {};
            const totalExp = data.totalExp || 0;
            const pageCount = data.pageCount || 0;
            
            tamagotchi_functions.updateVisuals(totalExp);
            tamagotchi_functions.updateStats(totalExp, pageCount);
        }, (error) => {
            console.error("다마고치 상태 감지 오류:", error);
        });
    },

    updateVisuals: (exp) => {
        const { level, levelName, maxExp, color } = tamagotchi_functions.getDetailsByExp(exp);
        
        // 다마고치 이미지 업데이트
        const imageUrl = `https://asia-northeast3-notion-tamagotchi.cloudfunctions.net/serveTamagotchiImage?uid=${currentUser?.uid}&t=${Date.now()}`;
        elements.tamagotchiImage.src = imageUrl;
        
        elements.tamagotchiLevel.textContent = `Level ${level}: ${levelName}`;
        elements.expDisplay.textContent = exp;
        
        // 경험치 바 애니메이션
        const progressPercentage = Math.min((exp / maxExp) * 100, 100);
        elements.expBar.style.width = `${progressPercentage}%`;
        
        // 레벨업 효과 (간단한 체크)
        if (exp > 0 && exp % 500 === 0) {
            tamagotchi_functions.showLevelUpEffect();
        }
    },

    updateStats: (totalExp, pageCount) => {
        elements.totalPages.textContent = pageCount;
        // 오늘 경험치는 간단히 총 경험치의 일부로 표시 (실제로는 별도 계산 필요)
        elements.todayExp.textContent = Math.min(totalExp, 100);
        // 연속일은 임시로 레벨 기반으로 계산
        const { level } = tamagotchi_functions.getDetailsByExp(totalExp);
        elements.currentStreak.textContent = Math.min(level, 30);
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
        
        return currentLevel;
    },

    showLevelUpEffect: () => {
        const effect = document.createElement('div');
        effect.className = 'fixed inset-0 flex items-center justify-center pointer-events-none z-50';
        effect.innerHTML = `
            <div class="bg-yellow-400 text-white px-8 py-4 rounded-xl shadow-lg text-2xl font-bold animate-bounce">
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
    // 햄버거 메뉴 관련
    elements.hamburgerButton?.addEventListener('click', sidebar.toggle);
    elements.closeSidebar?.addEventListener('click', sidebar.close);
    elements.sidebarOverlay?.addEventListener('click', sidebar.close);
    
    // ESC 키로 사이드바 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarOpen) {
            sidebar.close();
        }
    });
}

// 앱 초기화 및 메인 로직
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

