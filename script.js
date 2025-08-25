// Firebase SDK에서 필요한 함수들을 가져옵니다.
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

// 1. Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyDZZMSJG4sh9Vw-T7pjMztC2swkOg1i8os",
  authDomain: "notion-tamagotchi.firebaseapp.com",
  projectId: "notion-tamagotchi",
  storageBucket: "notion-tamagotchi.appspot.com",
  messagingSenderId: "128399204318",
  appId: "1:128399204318:web:197bf0d12b437b910f474f",
  measurementId: "G-02V3VDK4Q6"
};

// 2. Firebase 앱 초기화 및 서비스 사용 준비
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const functions = getFunctions(app, "asia-northeast3");

// 3. Notion OAuth 설정
const NOTION_CLIENT_ID = "259d872b-594c-80c7-9fd9-0037bc5be4d1";
const NOTION_REDIRECT_URI = "https://notiontamagotchi.netlify.app"; 

// 4. HTML 요소 가져오기
const welcomeMessage = document.getElementById('welcomeMessage');
const authButton = document.getElementById('authButton');
const authStatus = document.getElementById('authStatus');
const notionSection = document.getElementById('notionSection');
const notionConnectButton = document.getElementById('notionConnectButton');
const notionStatus = document.getElementById('notionStatus');
const databaseSection = document.getElementById('databaseSection');
const databaseSelect = document.getElementById('databaseSelect');
const propertySelect = document.getElementById('propertySelect');
const startButton = document.getElementById('startButton');
const gameSection = document.getElementById('gameSection');
const tamagotchiImage = document.getElementById('tamagotchiImage');
const tamagotchiLevel = document.getElementById('tamagotchiLevel');
const expDisplay = document.getElementById('expDisplay');
const expBar = document.getElementById('expBar');
const embedSection = document.getElementById('embedSection');
const embedLinkInput = document.getElementById('embedLinkInput');
const copyLinkButton = document.getElementById('copyLinkButton');
const copyStatus = document.getElementById('copyStatus');

let tamagotchiStateUnsubscribe = null;

// 5. 로그인/로그아웃 함수
const signIn = () => {
    signInWithPopup(auth, provider).catch((error) => {
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
            signInWithRedirect(auth, provider).catch(handleAuthError);
        } else {
            handleAuthError(error);
        }
    });
};

const logOut = () => {
    if (tamagotchiStateUnsubscribe) tamagotchiStateUnsubscribe();
    signOut(auth).catch((error) => console.error("로그아웃 실패:", error));
};

function handleAuthError(error) {
    console.error("인증 실패:", error);
    authStatus.textContent = `오류: ${error.message}`;
    authStatus.classList.remove('hidden');
}

// 6. 노션 연동 함수
const connectToNotion = () => {
    const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(NOTION_REDIRECT_URI)}`;
    window.location.href = authUrl;
};

// 7. 노션 인증 후 콜백 처리
const handleNotionCallback = async (user) => {
    if (!user) return;
    const urlParams = new URLSearchParams(window.location.search);
    const notionCode = urlParams.get('code');
    if (notionCode) {
        notionConnectButton.textContent = '토큰 교환 중...';
        notionConnectButton.disabled = true;
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
            const exchangeCodeForToken = httpsCallable(functions, 'exchangeCodeForToken');
            const tokenData = await exchangeCodeForToken({ code: notionCode, redirectUri: NOTION_REDIRECT_URI });
            const tokenDocRef = doc(db, "users", user.uid, "notion", "token");
            await setDoc(tokenDocRef, tokenData.data);
            updateNotionUI(true);
            loadDatabases();
        } catch (error) {
            console.error("액세스 토큰 처리 실패:", error);
            notionStatus.textContent = `오류: 토큰 처리에 실패했습니다.`;
        } finally {
            notionConnectButton.disabled = false;
        }
    }
};

// 8. UI 업데이트 함수
const updateNotionUI = (isConnected) => {
    if (isConnected) {
        notionConnectButton.textContent = '노션 재연동하기';
        notionConnectButton.classList.add('bg-green-600');
        notionStatus.textContent = '✅ 노션 연동 완료!';
        notionStatus.classList.remove('hidden');
        databaseSection.classList.remove('hidden');
    }
};

// 9. 사용자 데이터 로드
const loadUserData = async (user) => {
    if (!user) return;
    const tokenDocRef = doc(db, "users", user.uid, "notion", "token");
    const tokenSnap = await getDoc(tokenDocRef);
    if (tokenSnap.exists()) {
        updateNotionUI(true);
        await loadDatabases();
        const settingsDocRef = doc(db, "users", user.uid, "notion", "settings");
        const settingsSnap = await getDoc(settingsDocRef);
        if (settingsSnap.exists()) {
            const { selectedDbId, propertyName } = settingsSnap.data();
            databaseSelect.value = selectedDbId;
            await loadProperties();
            propertySelect.value = propertyName;
            // *** FIX: Immediately update EXP on load without showing an alert ***
            await saveSettingsAndRefreshExp(false);
        }
    }
};

// 10. 데이터베이스 및 속성 로드
const loadDatabases = async () => {
    databaseSelect.innerHTML = '<option>데이터베이스 목록을 불러오는 중...</option>';
    databaseSelect.disabled = true;
    try {
        const getNotionDatabases = httpsCallable(functions, 'getNotionDatabases');
        const result = await getNotionDatabases();
        const { databases } = result.data;
        if (databases && databases.length > 0) {
            databaseSelect.innerHTML = '<option value="">-- 데이터베이스 선택 --</option>';
            databases.forEach(db => {
                const option = document.createElement('option');
                option.value = db.id;
                option.textContent = db.title;
                databaseSelect.appendChild(option);
            });
            databaseSelect.disabled = false;
        } else {
            databaseSelect.innerHTML = '<option>연동된 데이터베이스가 없습니다.</option>';
        }
    } catch (error) {
        console.error("데이터베이스 목록 로드 실패:", error);
        databaseSelect.innerHTML = `<option>오류: ${error.message}</option>`;
    }
};

const loadProperties = async () => {
    const selectedDbId = databaseSelect.value;
    if (!selectedDbId) {
        propertySelect.innerHTML = '<option>먼저 데이터베이스를 선택하세요.</option>';
        propertySelect.disabled = true;
        startButton.disabled = true;
        return;
    }
    propertySelect.innerHTML = '<option>속성 목록 불러오는 중...</option>';
    propertySelect.disabled = true;
    startButton.disabled = true;
    try {
        const getDatabaseProperties = httpsCallable(functions, 'getDatabaseProperties');
        const result = await getDatabaseProperties({ databaseId: selectedDbId });
        const { properties } = result.data;
        if (properties && properties.length > 0) {
            propertySelect.innerHTML = '<option value="">-- 속성 선택 --</option>';
            properties.forEach(propName => {
                const option = document.createElement('option');
                option.value = propName;
                option.textContent = propName;
                propertySelect.appendChild(option);
            });
            propertySelect.disabled = false;
            startButton.disabled = false;
        } else {
            propertySelect.innerHTML = '<option>계산할 숫자/수식 속성이 없습니다.</option>';
        }
    } catch (error) {
        console.error("속성 목록 로드 실패:", error);
        propertySelect.innerHTML = `<option>오류: ${error.message}</option>`;
    }
};

// 11. 다마고치 상태 실시간 감지
const listenToTamagotchiState = (user) => {
    if (tamagotchiStateUnsubscribe) tamagotchiStateUnsubscribe();
    const stateDocRef = doc(db, "users", user.uid, "tamagotchi", "state");
    tamagotchiStateUnsubscribe = onSnapshot(stateDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const { totalExp } = docSnap.data();
            updateTamagotchiVisuals(totalExp);
        } else {
            updateTamagotchiVisuals(0);
        }
    });
};

// 12. 설정 저장 및 즉시 업데이트
const saveSettingsAndRefreshExp = async (showAlert = true) => {
    const selectedDbId = databaseSelect.value;
    const propertyName = propertySelect.value;
    if (!selectedDbId || !propertyName) {
        return alert("데이터베이스와 속성을 모두 선택해주세요!");
    }

    const user = auth.currentUser;
    if (user) {
        const settingsDocRef = doc(db, "users", user.uid, "notion", "settings");
        await setDoc(settingsDocRef, { selectedDbId, propertyName });
    }
    
    startButton.textContent = "업데이트 요청 중...";
    startButton.disabled = true;
    try {
        const calculateExperience = httpsCallable(functions, 'calculateExperience');
        await calculateExperience({ databaseId: selectedDbId, propertyName: propertyName });
        if (showAlert) {
            alert("설정이 저장되었습니다! 이제 서버에서 1분마다 자동 업데이트됩니다.");
        }
    } catch (error) {
        console.error("경험치 업데이트 실패:", error);
        if (showAlert) {
            alert(`오류: ${error.message}`);
        }
    } finally {
        startButton.textContent = "설정 저장 및 즉시 업데이트";
        startButton.disabled = false;
    }
};

/**
 * 경험치(EXP)에 따라 다마고치의 시각적 정보를 반환하는 헬퍼 함수
 */
const getTamagotchiDetailsByExp = (exp) => {
    let level = 1, levelName = "알", maxExp = 100, color = "#A0AEC0";

    if (exp >= 5000) { level = 10; levelName = "전설"; maxExp = 10000; color = "#F59E0B"; }
    else if (exp >= 4000) { level = 9; levelName = "궁극체"; maxExp = 5000; color = "#EF4444"; }
    else if (exp >= 3000) { level = 8; levelName = "완전체"; maxExp = 4000; color = "#8B5CF6"; }
    else if (exp >= 2200) { level = 7; levelName = "성숙기"; maxExp = 3000; color = "#3B82F6"; }
    else if (exp >= 1500) { level = 6; levelName = "성장기"; maxExp = 2200; color = "#10B981"; }
    else if (exp >= 900) { level = 5; levelName = "유년기2"; maxExp = 1500; color = "#EC4899"; }
    else if (exp >= 400) { level = 4; levelName = "유년기1"; maxExp = 900; color = "#F97316"; }
    else if (exp >= 100) { level = 3; levelName = "유아기"; maxExp = 400, color = "#14B8A6"; }
    else if (exp > 0) { level = 2; levelName = "새싹"; maxExp = 100; color = "#84CC16"; }
    
    return { level, levelName, maxExp, color };
};

// 13. 다마고치 시각화 업데이트
const updateTamagotchiVisuals = (exp) => {
    const { level, levelName, maxExp, color } = getTamagotchiDetailsByExp(exp);
    
    tamagotchiImage.src = `https://placehold.co/150x150/${color.substring(1)}/FFF?text=Lvl${level}.gif`;
    tamagotchiLevel.textContent = `Level ${level}: ${levelName}`;
    expDisplay.textContent = exp;
    expBar.style.width = `${Math.min((exp / maxExp) * 100, 100)}%`;
};

// 14. 링크 복사 함수
const copyEmbedLink = () => {
    const linkToCopy = embedLinkInput.value;
    navigator.clipboard.writeText(linkToCopy).then(() => {
        copyStatus.textContent = "✅ 복사 완료!";
        setTimeout(() => { copyStatus.textContent = ""; }, 2000);
    }).catch(err => {
        console.error('클립보드 복사 실패: ', err);
        copyStatus.textContent = "복사 실패. 직접 복사해주세요.";
    });
};

// 15. 앱 시작 로직
const mainApp = async () => {
    try {
        await setPersistence(auth, browserLocalPersistence);
        
        onAuthStateChanged(auth, (user) => {
            if (user) {
                gameSection.classList.remove('hidden');
                embedSection.classList.remove('hidden');
                notionSection.classList.remove('hidden');
                welcomeMessage.textContent = `${user.displayName}님, 환영합니다!`;
                authButton.textContent = '로그아웃';
                authButton.onclick = logOut;
                authStatus.classList.add('hidden');
                
                notionConnectButton.onclick = connectToNotion;
                databaseSelect.onchange = loadProperties;
                startButton.onclick = saveSettingsAndRefreshExp;
                copyLinkButton.onclick = copyEmbedLink;

                listenToTamagotchiState(user);
                handleNotionCallback(user);
                loadUserData(user);
                
                const imageUrl = `https://asia-northeast3-notion-tamagotchi.cloudfunctions.net/serveTamagotchiImage?uid=${user.uid}`;
                embedLinkInput.value = imageUrl;

            } else {
                welcomeMessage.textContent = '로그인하여 다마고치를 키워보세요!';
                authButton.textContent = '구글 계정으로 시작하기';
                authButton.onclick = signIn;
                authStatus.classList.add('hidden');
                gameSection.classList.add('hidden');
                embedSection.classList.add('hidden');
                notionSection.classList.add('hidden');
                databaseSection.classList.add('hidden');
            }
        });

        await getRedirectResult(auth);

    } catch (error) {
        handleAuthError(error);
    }
};

// 앱 시작!
mainApp();
