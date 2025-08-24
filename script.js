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
  storageBucket: "notion-tamagotchi.firebasestorage.app",
  messagingSenderId: "128399204318",
  appId: "1:128399204318:web:197bf0d12b437b910f474f",
  measurementId: "G-02V3VDK4Q6"
};

// 2. Firebase 앱 초기화 및 서비스 사용 준비
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 3. Notion OAuth 설정
const NOTION_CLIENT_ID = "259d872b-594c-4f7f-80c7-9f44c4f74d0d"; // 실제 값으로 변경됨
// *** UPDATED ***: 사용자가 설정한 영구 주소로 변경합니다.
const NOTION_REDIRECT_URI = "https://notiontamagotchi.netlify.app"; 

// 4. HTML 요소 가져오기
const welcomeMessage = document.getElementById('welcomeMessage');
const authButton = document.getElementById('authButton');
const authStatus = document.getElementById('authStatus');
const notionSection = document.getElementById('notionSection');
const notionConnectButton = document.getElementById('notionConnectButton');
const notionStatus = document.getElementById('notionStatus');
const gameSection = document.getElementById('gameSection');

// 5. 로그인/로그아웃 함수
const signIn = () => signInWithPopup(auth, provider).catch(handleAuthError);
const logOut = () => signOut(auth).catch((error) => console.error("로그아웃 실패:", error));

function handleAuthError(error) {
    console.error("인증 실패:", error);
    authStatus.textContent = `오류: ${error.message}`;
    authStatus.classList.remove('hidden');
}

// 6. 노션 연동 함수 (OAuth 리디렉션)
const connectToNotion = () => {
    console.log("노션 인증 페이지로 이동합니다...");
    const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(NOTION_REDIRECT_URI)}`;
    window.location.href = authUrl;
};

// 7. 노션 인증 후 콜백 처리 및 토큰 교환 함수
const handleNotionCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const notionCode = urlParams.get('code');

    if (notionCode) {
        console.log("노션 인증 코드 수신:", notionCode);
        notionConnectButton.textContent = '토큰 교환 중...';
        notionConnectButton.disabled = true;

        // URL에서 코드를 제거하여 새로고침 시 재실행되지 않도록 함
        window.history.replaceState({}, document.title, window.location.pathname);

        try {
            // 백엔드(Firebase Function)에 토큰 교환 요청
            const functionUrl = "https://asia-northeast3-notion-tamagotchi.cloudfunctions.net/exchangeCodeForToken";
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: notionCode,
                    redirectUri: NOTION_REDIRECT_URI,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`서버 오류: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            console.log("성공적으로 액세스 토큰을 받았습니다:", data);
            
            // TODO: 받은 access_token을 안전하게 저장해야 합니다. (다음 단계)
            
            updateNotionUI(true);

        } catch (error) {
            console.error("액세스 토큰 교환 실패:", error);
            notionStatus.textContent = `오류: 토큰 교환에 실패했습니다.`;
            notionStatus.classList.remove('hidden', 'text-green-600');
            notionStatus.classList.add('text-red-600');
            notionConnectButton.textContent = '연동 실패, 재시도';
        } finally {
            notionConnectButton.disabled = false;
        }
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
    if (user) {
        welcomeMessage.textContent = `${user.displayName}님, 환영합니다!`;
        authButton.textContent = '로그아웃';
        authStatus.textContent = `로그인 계정: ${user.email}`;
        authStatus.classList.remove('hidden');
        
        notionSection.classList.remove('hidden');
        gameSection.classList.remove('hidden');
        
        authButton.onclick = logOut;
        notionConnectButton.onclick = connectToNotion;

        handleNotionCallback();
    } else {
        welcomeMessage.textContent = '로그인하여 다마고치를 키워보세요!';
        authButton.textContent = '구글 계정으로 시작하기';
        authStatus.classList.add('hidden');
        
        notionSection.classList.add('hidden');
        gameSection.classList.add('hidden');
        
        authButton.onclick = signIn;
    }
});

