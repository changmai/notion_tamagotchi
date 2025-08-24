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
const propertySelect = document.getElementById('propertySelect');
const startButton = document.getElementById('startButton');
const gameSection = document.getElementById('gameSection');
const tamagotchiImage = document.getElementById('tamagotchiImage');
const tamagotchiLevel = document.getElementById('tamagotchiLevel');
const expDisplay = document.getElementById('expDisplay');
const expBar = document.getElementById('expBar');
const embedSection = document.getElementById('embedSection'); // 새 요소
const embedLinkInput = document.getElementById('embedLinkInput'); // 새 요소
const copyLinkButton = document.getElementById('copyLinkButton'); // 새 요소
const copyStatus = document.getElementById('copyStatus'); // 새 요소

// 경험치 자동 업데이트를 위한 변수
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

// 9. Firestore에서 사용자 데이터(토큰 및 설정) 로드 함수
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
            startExperienceCalculation(false);
        }
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
        databaseSelect.innerHTML = `<option>오류: ${error.message}</option>`;
    }
};

// 11. 속성 목록 로드 함수
const loadProperties = async () => {
    clearInterval(expUpdateInterval);
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
            propertySelect.innerHTML = '<option>계산할 숫자/함수 속성이 없습니다.</option>';
        }

    } catch (error) {
        propertySelect.innerHTML = `<option>오류: ${error.message}</option>`;
    }
};

// 12. 경험치 계산 및 자동 업데이트 시작 함수
const startExperienceCalculation = async (showAlert = true) => {
    clearInterval(expUpdateInterval);

    const selectedDbId = databaseSelect.value;
    const propertyName = propertySelect.value;

    if (!selectedDbId || !propertyName) {
        if (showAlert) alert("데이터베이스와 속성을 모두 선택해주세요!");
        return;
    }

    const user = auth.currentUser;
    if (user) {
        const settingsDocRef = doc(db, "users", user.uid, "notion", "settings");
        await setDoc(settingsDocRef, { selectedDbId, propertyName });
    }

    const updateExp = async () => {
        startButton.textContent = "경험치 업데이트 중...";
        startButton.disabled = true;

        try {
            const calculateExperience = httpsCallable(functions, 'calculateExperience');
            const result = await calculateExperience({ databaseId: selectedDbId, propertyName: propertyName });
            const { totalExp } = result.data;

            expDisplay.textContent = totalExp;
            const expPercentage = Math.min((totalExp / 1000) * 100, 100);
            expBar.style.width = `${expPercentage}%`;
            
            updateTamagotchiVisuals(totalExp);

        } catch (error) {
            console.error("경험치 계산 실패:", error);
            clearInterval(expUpdateInterval);
            alert(`오류: ${error.message}`);
        } finally {
            startButton.textContent = "경험치 자동 업데이트 시작!";
            startButton.disabled = false;
        }
    };

    updateExp();
    expUpdateInterval = setInterval(updateExp, 60000);
    if (showAlert) alert("경험치 자동 업데이트가 시작되었습니다. 1분마다 갱신됩니다.");
};

// 13. 다마고치 시각화 업데이트 함수
const updateTamagotchiVisuals = (exp) => {
    let level = 1;
    let levelName = "알";
    let imageUrl = "https://placehold.co/150x150/E2E8F0/A0AEC0?text=Egg";

    if (exp >= 1000) {
        level = 5;
        levelName = "어른";
        imageUrl = "https://placehold.co/150x150/FDE68A/D97706?text=Adult";
    } else if (exp >= 600) {
        level = 4;
        levelName = "청소년";
        imageUrl = "https://placehold.co/150x150/FBCFE8/DB2777?text=Teen";
    } else if (exp >= 300) {
        level = 3;
        levelName = "어린이";
        imageUrl = "https://placehold.co/150x150/BAE6FD/0284C7?text=Child";
    } else if (exp >= 100) {
        level = 2;
        levelName = "아기";
        imageUrl = "https://placehold.co/150x150/A7F3D0/10B981?text=Baby";
    }

    tamagotchiImage.src = imageUrl;
    tamagotchiLevel.textContent = `Level ${level}: ${levelName}`;
};

// *** NEW *** 14. 임베딩 링크 복사 함수
const copyEmbedLink = () => {
    embedLinkInput.select();
    document.execCommand('copy');
    copyStatus.textContent = "✅ 복사 완료!";
    setTimeout(() => {
        copyStatus.textContent = "";
    }, 2000); // 2초 후에 메시지 사라짐
};

// 15. 앱 시작 시 인증 상태를 처리하는 핵심 로직
try {
    await getRedirectResult(auth);
    onAuthStateChanged(auth, (user) => {
        if (user) {
            welcomeMessage.textContent = `${user.displayName}님, 환영합니다!`;
            authButton.textContent = '로그아웃';
            notionSection.classList.remove('hidden');
            gameSection.classList.remove('hidden');
            embedSection.classList.remove('hidden'); // 링크 섹션 보이기
            authButton.onclick = logOut;
            notionConnectButton.onclick = connectToNotion;
            databaseSelect.onchange = loadProperties;
            startButton.onclick = startExperienceCalculation;
            copyLinkButton.onclick = copyEmbedLink; // 복사 버튼에 기능 연결

            // *** NEW ***: 임베딩 링크 생성 및 표시
            const imageUrl = `https://asia-northeast3-notion-tamagotchi.cloudfunctions.net/serveTamagotchiImage?uid=${user.uid}`;
            embedLinkInput.value = imageUrl;

            handleNotionCallback(user);
            loadUserData(user);
        } else {
            welcomeMessage.textContent = '로그인하여 다마고치를 키워보세요!';
            authButton.textContent = '구글 계정으로 시작하기';
            notionSection.classList.add('hidden');
            databaseSection.classList.add('hidden');
            gameSection.classList.add('hidden');
            embedSection.classList.add('hidden'); // 링크 섹션 숨기기
            authButton.onclick = signIn;
        }
    });
} catch (error) {
    handleAuthError(error);
}
