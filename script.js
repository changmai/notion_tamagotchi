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
    getDoc 
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
const propertySelect = document.getElementById('propertySelect'); // 새 요소
const startButton = document.getElementById('startButton');
const gameSection = document.getElementById('gameSection');
const expDisplay = document.getElementById('expDisplay');
const expBar = document.getElementById('expBar');

// *** NEW ***: 경험치 자동 업데이트를 위한 변수
let expUpdateInterval = null;

// 5. 로그인/로그아웃 함수 (하이브리드 방식)
const signIn = async () => {
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithPopup(auth, provider);
    } catch (error) {
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
            signInWithRedirect(auth, provider).catch(handleAuthError);
        } else {
            handleAuthError(error);
        }
    }
};

const logOut = () => {
    clearInterval(expUpdateInterval); // 로그아웃 시 자동 업데이트 중지
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

// 7. 노션 인증 후 콜백 처리 및 토큰 저장 함수
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

// 8. 노션 연동 상태 UI 업데이트 함수
const updateNotionUI = (isConnected) => {
    if (isConnected) {
        notionConnectButton.textContent = '노션 재연동하기';
        notionConnectButton.classList.add('bg-green-600');
        notionStatus.textContent = '✅ 노션 연동 완료!';
        notionStatus.classList.remove('hidden');
        databaseSection.classList.remove('hidden');
    }
};

// 9. Firestore에서 노션 토큰 확인하는 함수
const checkNotionConnection = async (user) => {
    if (!user) return;
    const tokenDocRef = doc(db, "users", user.uid, "notion", "token");
    const docSnap = await getDoc(tokenDocRef);

    if (docSnap.exists()) {
        updateNotionUI(true);
        loadDatabases();
    }
};

// 10. 데이터베이스 목록 로드 함수
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
            databaseSelect.innerHTML = '<option>공유된 데이터베이스가 없습니다.</option>';
        }

    } catch (error) {
        console.error("데이터베이스 목록 로드 실패:", error);
        databaseSelect.innerHTML = `<option>오류: ${error.message}</option>`;
    }
};

// *** NEW *** 11. 속성 목록 로드 함수
const loadProperties = async () => {
    clearInterval(expUpdateInterval); // 다른 DB 선택 시 자동 업데이트 중지
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
            propertySelect.innerHTML = '';
            properties.forEach(propName => {
                const option = document.createElement('option');
                option.value = propName;
                option.textContent = propName;
                propertySelect.appendChild(option);
            });
            propertySelect.disabled = false;
            startButton.disabled = false;
        } else {
            propertySelect.innerHTML = '<option>계산할 숫자 속성이 없습니다.</option>';
        }

    } catch (error) {
        console.error("속성 목록 로드 실패:", error);
        propertySelect.innerHTML = `<option>오류: ${error.message}</option>`;
    }
};

// *** UPDATED *** 12. 경험치 계산 및 자동 업데이트 시작 함수
const startExperienceCalculation = () => {
    clearInterval(expUpdateInterval); // 이전 인터벌이 있다면 중지

    const updateExp = async () => {
        const selectedDbId = databaseSelect.value;
        const propertyName = propertySelect.value;

        if (!selectedDbId || !propertyName) return;

        startButton.textContent = "경험치 업데이트 중...";
        startButton.disabled = true;

        try {
            const calculateExperience = httpsCallable(functions, 'calculateExperience');
            const result = await calculateExperience({ databaseId: selectedDbId, propertyName: propertyName });
            const { totalExp } = result.data;

            console.log("계산된 총 경험치:", totalExp);
            expDisplay.textContent = totalExp;
            const expPercentage = Math.min((totalExp / 1000) * 100, 100);
            expBar.style.width = `${expPercentage}%`;

        } catch (error) {
            console.error("경험치 계산 실패:", error);
            clearInterval(expUpdateInterval); // 오류 발생 시 자동 업데이트 중지
            alert(`오류: ${error.message}`);
        } finally {
            startButton.textContent = "경험치 자동 업데이트 시작!";
            startButton.disabled = false;
        }
    };

    updateExp(); // 먼저 한 번 즉시 실행
    expUpdateInterval = setInterval(updateExp, 60000); // 그 후 1분(60000ms)마다 반복
    alert("경험치 자동 업데이트가 시작되었습니다. 1분마다 갱신됩니다.");
};


// 13. 앱 시작 시 인증 상태를 처리하는 핵심 로직
try {
    await getRedirectResult(auth);
    onAuthStateChanged(auth, (user) => {
        if (user) {
            welcomeMessage.textContent = `${user.displayName}님, 환영합니다!`;
            authButton.textContent = '로그아웃';
            notionSection.classList.remove('hidden');
            gameSection.classList.remove('hidden');
            authButton.onclick = logOut;
            notionConnectButton.onclick = connectToNotion;
            databaseSelect.onchange = loadProperties; // *** NEW ***
            startButton.onclick = startExperienceCalculation;

            handleNotionCallback(user);
            checkNotionConnection(user);
        } else {
            welcomeMessage.textContent = '로그인하여 다마고치를 키워보세요!';
            authButton.textContent = '구글 계정으로 시작하기';
            notionSection.classList.add('hidden');
            databaseSection.classList.add('hidden');
            gameSection.classList.add('hidden');
            authButton.onclick = signIn;
        }
    });
} catch (error) {
    handleAuthError(error);
}
