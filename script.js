// Firebase SDK에서 필요한 함수들을 가져옵니다. (모듈 방식)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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

// 3. Notion OAuth 설정
// !!! 중요: "YOUR_NOTION_CLIENT_ID"를 실제 값으로 꼭 변경해야 합니다. !!!
const NOTION_CLIENT_ID = "259d872b-594c-80c7-9fd9-0037bc5be4d1"; 
// *** UPDATED ***: 동적 주소 대신 Netlify의 고정 주소를 사용합니다.
const NOTION_REDIRECT_URI = "https://notiontamagotchi.netlify.app";

// *** NEW *** 설정 값 확인 로직 추가
if (NOTION_CLIENT_ID === "YOUR_NOTION_CLIENT_ID") {
    const errorMessage = "!!! 설정 오류: script.js 파일의 NOTION_CLIENT_ID를 실제 값으로 변경해야 합니다. !!!";
    console.error(errorMessage);
    // 화면에 직접 오류를 표시하여 문제를 바로 알 수 있도록 합니다.
    document.addEventListener('DOMContentLoaded', () => {
        document.body.innerHTML = `<div style="padding: 2rem; text-align: center; background-color: #fee2e2; color: #b91c1c;">
            <h1 style="font-size: 1.5rem; font-weight: bold;">설정 오류!</h1>
            <p>${errorMessage}</p>
        </div>`;
    });
}


// 4. HTML 요소 가져오기
const welcomeMessage = document.getElementById('welcomeMessage');
const authButton = document.getElementById('authButton');
const authStatus = document.getElementById('authStatus');
const notionSection = document.getElementById('notionSection');
const notionConnectButton = document.getElementById('notionConnectButton');
const notionStatus = document.getElementById('notionStatus');
const gameSection = document.getElementById('gameSection');

// 5. 로그인/로그아웃 함수
const signIn = () => {
    signInWithPopup(auth, provider).catch(handleAuthError);
};

const logOut = () => {
    signOut(auth).catch((error) => console.error("로그아웃 실패:", error));
};

function handleAuthError(error) {
    console.error("인증 실패:", error);
    authStatus.textContent = `오류: ${error.message}`;
    authStatus.classList.remove('hidden');
}

// 6. 노션 연동 함수 (OAuth 리디렉션)
const connectToNotion = () => {
    console.log("노션 인증 페이지로 이동합니다...");
    const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(NOTION_REDIRECT_URI)}`;
    window.location.href = authUrl; // 노션 인증 페이지로 이동
};

// 7. 노션 인증 후 콜백 처리 함수
const handleNotionCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const notionCode = urlParams.get('code');

    if (notionCode) {
        console.log("노션 인증 코드 수신:", notionCode);
        
        // 다음 단계: 이 'notionCode'를 백엔드로 보내 'access_token'으로 교환
        updateNotionUI(true);

        // URL에서 코드를 제거하여 새로고침 시 재실행되지 않도록 함
        window.history.replaceState({}, document.title, window.location.pathname);
    }
};

// 8. 노션 연동 상태 UI 업데이트 함수
const updateNotionUI = (isConnected) => {
    if (isConnected) {
        notionConnectButton.textContent = '노션 재연동하기';
        notionConnectButton.classList.remove('bg-gray-800', 'hover:bg-gray-900');
        notionConnectButton.classList.add('bg-green-600', 'hover:bg-green-700');
        notionStatus.classList.remove('hidden');
    }
};

// 9. 사용자 인증 상태 변화 감지
onAuthStateChanged(auth, (user) => {
    if (NOTION_CLIENT_ID === "YOUR_NOTION_CLIENT_ID") return; // 설정 오류 시 앱 실행 중단

    if (user) {
        // 사용자가 로그인한 경우
        welcomeMessage.textContent = `${user.displayName}님, 환영합니다!`;
        authButton.textContent = '로그아웃';
        authStatus.textContent = `로그인 계정: ${user.email}`;
        authStatus.classList.remove('hidden');
        
        notionSection.classList.remove('hidden');
        gameSection.classList.remove('hidden');
        
        authButton.onclick = logOut;
        notionConnectButton.onclick = connectToNotion;

        // 페이지 로드 시 노션 콜백 처리
        handleNotionCallback();

    } else {
        // 사용자가 로그아웃한 경우
        welcomeMessage.textContent = '로그인하여 다마고치를 키워보세요!';
        authButton.textContent = '구글 계정으로 시작하기';
        authStatus.classList.add('hidden');
        
        notionSection.classList.add('hidden');
        gameSection.classList.add('hidden');
        
        authButton.onclick = signIn;
    }
});

