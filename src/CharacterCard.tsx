import React, { useState, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';

// =======================================================================
// 1. 캐릭터 스타일 정의
// =======================================================================
const levelStyles: { [key: number]: any } = {
    1: { bodyFill: 'rgb(251, 113, 133)', highlightFill: 'rgb(253, 164, 175)', strokeFill: 'rgb(136, 19, 55)', tongueFill: 'rgb(220, 20, 60)', showCrown: false, showGem: false, showWingsAndMagic: false, showAura: false },
    2: { bodyFill: '#87CEEB', highlightFill: '#B0E0E6', strokeFill: '#4682B4', tongueFill: '#FF6347', showCrown: false, showGem: false, showWingsAndMagic: false, showAura: false },
    3: { bodyFill: '#87CEEB', highlightFill: '#B0E0E6', strokeFill: '#4682B4', tongueFill: '#FF6347', showCrown: true, crownFill: '#FFD700', showGem: false, showWingsAndMagic: false, showAura: false },
    4: { bodyFill: '#90EE90', highlightFill: '#98FB98', strokeFill: '#2E8B57', tongueFill: '#FF7F50', showCrown: true, crownFill: '#FFD700', showGem: false, showWingsAndMagic: false, showAura: false },
    5: { bodyFill: '#90EE90', highlightFill: '#98FB98', strokeFill: '#2E8B57', tongueFill: '#FF7F50', showCrown: true, crownFill: '#FFD700', showGem: true, gemFill: '#FF4500', showWingsAndMagic: false, showAura: false },
    6: { bodyFill: '#FFD700', highlightFill: '#FFFACD', strokeFill: '#B8860B', tongueFill: '#E9967A', showCrown: true, crownFill: '#C0C0C0', showGem: true, gemFill: '#FF4500', showWingsAndMagic: true, showAura: false },
    7: { bodyFill: '#FFD700', highlightFill: '#FFFACD', strokeFill: '#B8860B', tongueFill: '#E9967A', showCrown: true, crownFill: '#C0C0C0', showGem: true, gemFill: '#00FFFF', showWingsAndMagic: true, showAura: false },
    8: { bodyFill: '#E6E6FA', highlightFill: '#FFFFFF', strokeFill: '#9370DB', tongueFill: '#F08080', showCrown: true, crownFill: '#FFD700', showGem: true, gemFill: '#00FFFF', showWingsAndMagic: true, showAura: false },
    9: { bodyFill: '#E6E6FA', highlightFill: '#FFFFFF', strokeFill: '#9370DB', tongueFill: '#F08080', showCrown: true, crownFill: '#FFD700', showGem: true, gemFill: '#DA70D6', showWingsAndMagic: true, showAura: true, auraFill: 'gold' },
    10: { bodyFill: '#D3D3D3', highlightFill: '#F5F5F5', strokeFill: '#696969', tongueFill: '#B22222', showCrown: true, crownFill: '#FFD700', showGem: true, gemFill: '#DA70D6', showWingsAndMagic: true, showAura: true, auraFill: 'url(#rainbowAura)' },
};

// =======================================================================
// 2. 캐릭터 SVG 컴포넌트 (날개와 마법진 모두 포함)
// =======================================================================
const CharacterSVG: React.FC<{ svgRef: React.Ref<SVGSVGElement>, level: number }> = ({ svgRef, level }) => {
    const styles = levelStyles[level] || levelStyles[1];
    const isMultiGemLevel = level >= 7;

    // 날개 스타일 가져오기
    const getWingStyle = (level: number) => {
        if (level < 6) return null;
        switch (true) {
            case level >= 10:
                return {
                    wingColor: 'url(#rainbowWingGradient)',
                    wingStroke: '#FFD700',
                    wingOpacity: 0.9,
                    wingSize: 1.8,
                    feathers: 'rainbow'
                };
            case level >= 8:
                return {
                    wingColor: '#FFFFFF',
                    wingStroke: '#E6E6FA',
                    wingOpacity: 0.8,
                    wingSize: 1.6,
                    feathers: 'angel'
                };
            case level >= 6:
                return {
                    wingColor: '#F0F8FF',
                    wingStroke: '#87CEEB',
                    wingOpacity: 0.7,
                    wingSize: 1.4,
                    feathers: 'simple'
                };
            default:
                return null;
        }
    };

    // 마법진 스타일 가져오기
    const getMagicCircleStyle = (level: number) => {
        if (level < 6) return null;
        switch (true) {
            case level >= 10:
                return {
                    circleColor: 'url(#rainbowCircleGradient)',
                    runeColor: '#FFD700',
                    runeCount: 12
                };
            case level >= 8:
                return {
                    circleColor: '#E6E6FA',
                    runeColor: '#9370DB',
                    runeCount: 8
                };
            case level >= 6:
                return {
                    circleColor: '#87CEEB',
                    runeColor: '#4682B4',
                    runeCount: 6
                };
            default:
                return null;
        }
    };

    const wingStyle = getWingStyle(level);
    const circleStyle = getMagicCircleStyle(level);

    return (
        <svg
            ref={svgRef}
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 250 250"
            className="w-full h-full overflow-visible"
        >
            <defs>
                {/* 기존 레인보우 그라디언트 */}
                <linearGradient id="rainbowAura" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="red" />
                    <stop offset="20%" stopColor="orange" />
                    <stop offset="40%" stopColor="yellow" />
                    <stop offset="60%" stopColor="green" />
                    <stop offset="80%" stopColor="blue" />
                    <stop offset="100%" stopColor="purple" />
                </linearGradient>

                {/* 무지개 날개 그라디언트 */}
                <linearGradient id="rainbowWingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff6b6b" stopOpacity="0.9" />
                    <stop offset="20%" stopColor="#ffa500" stopOpacity="0.9" />
                    <stop offset="40%" stopColor="#ffff00" stopOpacity="0.9" />
                    <stop offset="60%" stopColor="#00ff00" stopOpacity="0.9" />
                    <stop offset="80%" stopColor="#0080ff" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#8000ff" stopOpacity="0.9" />
                </linearGradient>

                {/* 무지개 마법진 그라디언트 */}
                <radialGradient id="rainbowCircleGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FFD700" stopOpacity="0.4" />
                    <stop offset="30%" stopColor="#ff6b6b" stopOpacity="0.3" />
                    <stop offset="60%" stopColor="#0080ff" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#8000ff" stopOpacity="0.2" />
                </radialGradient>

                {/* 진짜 오로라 같은 그라디언트들 */}
                <radialGradient id="goldAuraGradient" cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor="gold" stopOpacity="0" />
                    <stop offset="20%" stopColor="gold" stopOpacity="0.1" />
                    <stop offset="40%" stopColor="gold" stopOpacity="0.3" />
                    <stop offset="60%" stopColor="gold" stopOpacity="0.2" />
                    <stop offset="80%" stopColor="gold" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="gold" stopOpacity="0" />
                </radialGradient>

                <radialGradient id="rainbowAuraGradient" cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor="#ff6b6b" stopOpacity="0" />
                    <stop offset="15%" stopColor="#ff6b6b" stopOpacity="0.1" />
                    <stop offset="30%" stopColor="#ffa500" stopOpacity="0.2" />
                    <stop offset="45%" stopColor="#ffff00" stopOpacity="0.15" />
                    <stop offset="60%" stopColor="#00ff00" stopOpacity="0.2" />
                    <stop offset="75%" stopColor="#0080ff" stopOpacity="0.1" />
                    <stop offset="90%" stopColor="#8000ff" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#8000ff" stopOpacity="0" />
                </radialGradient>

                {/* 오로라 웨이브 그라디언트 */}
                <linearGradient id="auroraWave" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="gold" stopOpacity="0.05" />
                    <stop offset="25%" stopColor="gold" stopOpacity="0.15" />
                    <stop offset="50%" stopColor="gold" stopOpacity="0.08" />
                    <stop offset="75%" stopColor="gold" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="gold" stopOpacity="0.03" />
                </linearGradient>

                <linearGradient id="rainbowWave" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff6b6b" stopOpacity="0.05" />
                    <stop offset="20%" stopColor="#ffa500" stopOpacity="0.1" />
                    <stop offset="40%" stopColor="#ffff00" stopOpacity="0.08" />
                    <stop offset="60%" stopColor="#00ff00" stopOpacity="0.1" />
                    <stop offset="80%" stopColor="#0080ff" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#8000ff" stopOpacity="0.03" />
                </linearGradient>

                {/* 오로라 블러 효과 */}
                <filter id="auraGlow">
                    <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                
                <filter id="auraBlur">
                    <feGaussianBlur stdDeviation="12"/>
                </filter>

                <filter id="softAura">
                    <feGaussianBlur stdDeviation="15"/>
                </filter>

                {/* 날개 그림자 효과 */}
                <filter id="wingShadow">
                    <feDropShadow dx="3" dy="3" stdDeviation="4" floodOpacity="0.5"/>
                </filter>

                {/* 마법진 글로우 효과 */}
                <filter id="magicGlow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>

            <g data-name="character-container">
                {/* 진짜 오로라 같은 다층 아우라 */}
                {styles.showAura && (
                    <g data-name="aura">
                        {/* 가장 외곽 오로라 - 매우 흐리게 */}
                        <ellipse cx="125" cy="125.8" rx="200" ry="200" 
                            fill={level === 10 ? "url(#rainbowAuraGradient)" : "url(#goldAuraGradient)"} 
                            filter="url(#softAura)"
                            opacity="0.15">
                            <animateTransform 
                                attributeName="transform" 
                                type="rotate" 
                                values="0 125 125.8;360 125 125.8" 
                                dur="15s" 
                                repeatCount="indefinite"/>
                        </ellipse>

                        {/* 웨이브 오로라 레이어 */}
                        <ellipse cx="125" cy="125.8" rx="170" ry="190" 
                            fill={level === 10 ? "url(#rainbowWave)" : "url(#auroraWave)"} 
                            filter="url(#auraBlur)"
                            opacity="0.12">
                            <animateTransform 
                                attributeName="transform" 
                                type="rotate" 
                                values="360 125 125.8;0 125 125.8" 
                                dur="20s" 
                                repeatCount="indefinite"/>
                            <animate 
                                attributeName="opacity" 
                                values="0.08;0.18;0.08" 
                                dur="8s" 
                                repeatCount="indefinite"/>
                        </ellipse>

                        {/* 중간 오로라 */}
                        <ellipse cx="125" cy="125.8" rx="160" ry="160" 
                            fill={level === 10 ? "url(#rainbowAuraGradient)" : "url(#goldAuraGradient)"} 
                            filter="url(#auraGlow)"
                            opacity="0.1">
                            <animateTransform 
                                attributeName="transform" 
                                type="rotate" 
                                values="0 125 125.8;360 125 125.8" 
                                dur="12s" 
                                repeatCount="indefinite"/>
                            <animate 
                                attributeName="opacity" 
                                values="0.05;0.15;0.05" 
                                dur="6s" 
                                repeatCount="indefinite"/>
                        </ellipse>

                        {/* 내부 오로라 - 가장 선명 */}
                        <ellipse cx="125" cy="125.8" rx="140" ry="140" 
                            fill={level === 10 ? "url(#rainbowAuraGradient)" : "url(#goldAuraGradient)"} 
                            opacity="0.08">
                            <animate 
                                attributeName="opacity" 
                                values="0.04;0.12;0.04" 
                                dur="4s" 
                                repeatCount="indefinite"/>
                        </ellipse>

                        {/* 펄싱 오로라 효과 */}
                        <ellipse cx="125" cy="125.8" rx="180" ry="180" 
                            fill={level === 10 ? "url(#rainbowWave)" : "url(#auroraWave)"} 
                            filter="url(#softAura)"
                            opacity="0.06">
                            <animate 
                                attributeName="rx" 
                                values="180;220;180" 
                                dur="10s" 
                                repeatCount="indefinite"/>
                            <animate 
                                attributeName="ry" 
                                values="180;220;180" 
                                dur="10s" 
                                repeatCount="indefinite"/>
                            <animate 
                                attributeName="opacity" 
                                values="0.02;0.1;0.02" 
                                dur="7s" 
                                repeatCount="indefinite"/>
                        </ellipse>
                    </g>
                )}

                {/* 개선된 바닥 마법진 (타원형으로 입체감) */}
                {styles.showWingsAndMagic && circleStyle && (
                    <g data-name="magic-circle" transform="translate(125, 230)">
                        {/* 외곽 타원 (바닥에 깔린 느낌) */}
                        <ellipse 
                            rx="70" 
                            ry="25"
                            fill="none" 
                            stroke={circleStyle.circleColor}
                            strokeWidth="3"
                            opacity="0.6"
                            filter="url(#magicGlow)">
                            <animateTransform 
                                attributeName="transform" 
                                type="rotate" 
                                values="0;360" 
                                dur="12s" 
                                repeatCount="indefinite"/>
                        </ellipse>

                        {/* 중간 타원 */}
                        <ellipse 
                            rx="50" 
                            ry="18"
                            fill="none" 
                            stroke={circleStyle.runeColor}
                            strokeWidth="2.5"
                            opacity="0.7">
                            <animateTransform 
                                attributeName="transform" 
                                type="rotate" 
                                values="360;0" 
                                dur="8s" 
                                repeatCount="indefinite"/>
                        </ellipse>

                        {/* 내부 타원 */}
                        <ellipse 
                            rx="30" 
                            ry="10"
                            fill="none" 
                            stroke={circleStyle.runeColor}
                            strokeWidth="2"
                            opacity="0.8">
                            <animateTransform 
                                attributeName="transform" 
                                type="rotate" 
                                values="0;360" 
                                dur="6s" 
                                repeatCount="indefinite"/>
                        </ellipse>

                        {/* 룬 문자들 (타원 궤도를 따라, 바닥에 깔린 느낌) */}
                        {Array.from({ length: circleStyle.runeCount }, (_, i) => {
                            const angle = (360 / circleStyle.runeCount) * i;
                            const runes = ['ᚱ', 'ᚢ', 'ᚾ', 'ᛖ', 'ᚴ', 'ᚨ', 'ᚦ', 'ᛁ', 'ᚠ', 'ᚺ', 'ᛚ', 'ᚷ'];
                            return (
                                <text
                                    key={i}
                                    x="0"
                                    y="-35"
                                    textAnchor="middle"
                                    fontSize="12"
                                    fill={circleStyle.runeColor}
                                    opacity="0.9"
                                    transform={`rotate(${angle}) scale(1, 0.3)`}
                                    filter="url(#magicGlow)"
                                >
                                    {runes[i % runes.length]}
                                    <animate 
                                        attributeName="opacity" 
                                        values="0.6;1;0.6" 
                                        dur={`${3 + i * 0.3}s`} 
                                        repeatCount="indefinite"/>
                                </text>
                            );
                        })}

                        {/* 중앙 별 (입체감 적용) */}
                        <polygon
                            points="0,-10 4,-4 10,0 4,4 0,10 -4,4 -10,0 -4,-4"
                            fill={circleStyle.runeColor}
                            opacity="0.9"
                            transform="scale(1, 0.25)">
                            <animate 
                                attributeName="opacity" 
                                values="0.7;1;0.7" 
                                dur="4s" 
                                repeatCount="indefinite"/>
                            <animateTransform 
                                attributeName="transform" 
                                type="rotate" 
                                values="0;360" 
                                dur="5s" 
                                repeatCount="indefinite"
                                additive="sum"/>
                        </polygon>
                    </g>
                )}

                {/* 날개 (캐릭터와 함께 움직임) - 더 바깥쪽으로 배치 */}
                {wingStyle && (
                    <g data-name="wings" opacity={wingStyle.wingOpacity}>
                        {/* 왼쪽 날개 - 훨씬 더 바깥쪽으로 (25 → 10) */}
                        <g transform={`translate(25, 125) scale(${wingStyle.wingSize})`}>
                            <path
                                d="M0,0 Q-30,-20 -50,-10 Q-45,-5 -30,10 Q-20,25 -10,20 Q-5,10 0,0"
                                fill={wingStyle.wingColor}
                                stroke={wingStyle.wingStroke}
                                strokeWidth="2"
                                filter="url(#wingShadow)"
                            >
                                <animateTransform
                                    attributeName="transform"
                                    type="rotate"
                                    values="0;-10;0;10;0"
                                    dur="2.5s"
                                    repeatCount="indefinite"
                                />
                            </path>

                            {/* 깃털 디테일 */}
                            {wingStyle.feathers !== 'simple' && (
                                <g opacity="0.8">
                                    <path d="M-15,4 Q-22,-4 -30,0" stroke={wingStyle.wingStroke} strokeWidth="1.5" fill="none"/>
                                    <path d="M-12,12 Q-18,4 -26,8" stroke={wingStyle.wingStroke} strokeWidth="1.5" fill="none"/>
                                    <path d="M-8,16 Q-15,8 -23,12" stroke={wingStyle.wingStroke} strokeWidth="1.5" fill="none"/>
                                    {wingStyle.feathers === 'angel' && (
                                        <>
                                            <path d="M-18,0 Q-28,-12 -35,-5" stroke={wingStyle.wingStroke} strokeWidth="1" fill="none"/>
                                            <path d="M-20,-5 Q-30,-15 -38,-8" stroke={wingStyle.wingStroke} strokeWidth="0.8" fill="none"/>
                                        </>
                                    )}
                                </g>
                            )}
                        </g>

                        {/* 오른쪽 날개 - 훨씬 더 바깥쪽으로 (225 → 240) */}
                        <g transform={`translate(225, 125) scale(${wingStyle.wingSize}) scale(-1, 1)`}>
                            <path
                                d="M0,0 Q-30,-20 -50,-10 Q-45,-5 -30,10 Q-20,25 -10,20 Q-5,10 0,0"
                                fill={wingStyle.wingColor}
                                stroke={wingStyle.wingStroke}
                                strokeWidth="2"
                                filter="url(#wingShadow)"
                            >
                                <animateTransform
                                    attributeName="transform"
                                    type="rotate"
                                    values="0;10;0;-10;0"
                                    dur="2.5s"
                                    repeatCount="indefinite"
                                />
                            </path>

                            {/* 깃털 디테일 */}
                            {wingStyle.feathers !== 'simple' && (
                                <g opacity="0.8">
                                    <path d="M-15,4 Q-22,-4 -30,0" stroke={wingStyle.wingStroke} strokeWidth="1.5" fill="none"/>
                                    <path d="M-12,12 Q-18,4 -26,8" stroke={wingStyle.wingStroke} strokeWidth="1.5" fill="none"/>
                                    <path d="M-8,16 Q-15,8 -23,12" stroke={wingStyle.wingStroke} strokeWidth="1.5" fill="none"/>
                                    {wingStyle.feathers === 'angel' && (
                                        <>
                                            <path d="M-18,0 Q-28,-12 -35,-5" stroke={wingStyle.wingStroke} strokeWidth="1" fill="none"/>
                                            <path d="M-20,-5 Q-30,-15 -38,-8" stroke={wingStyle.wingStroke} strokeWidth="0.8" fill="none"/>
                                        </>
                                    )}
                                </g>
                            )}
                        </g>

                        {/* 레벨 10 특별 효과 - 날개 주변 파티클 */}
                        {level >= 10 && (
                            <g>
                                {/* 왼쪽 날개 파티클 */}
                                {Array.from({ length: 6 }, (_, i) => (
                                    <circle
                                        key={`left-${i}`}
                                        r="2"
                                        fill="#FFD700"
                                        opacity="0.8"
                                        transform={`translate(10, 125) rotate(${60 * i}) translate(-60, 0)`}
                                    >
                                        <animate 
                                            attributeName="opacity" 
                                            values="0.4;1;0.4" 
                                            dur={`${2 + i * 0.3}s`} 
                                            repeatCount="indefinite"/>
                                        <animateTransform
                                            attributeName="transform"
                                            type="rotate"
                                            values={`${60 * i} 10 125;${60 * i + 360} 10 125`}
                                            dur="8s"
                                            repeatCount="indefinite"
                                        />
                                    </circle>
                                ))}
                                {/* 오른쪽 날개 파티클 */}
                                {Array.from({ length: 6 }, (_, i) => (
                                    <circle
                                        key={`right-${i}`}
                                        r="2"
                                        fill="#FFD700"
                                        opacity="0.8"
                                        transform={`translate(240, 125) rotate(${60 * i}) translate(60, 0)`}
                                    >
                                        <animate 
                                            attributeName="opacity" 
                                            values="0.4;1;0.4" 
                                            dur={`${2.5 + i * 0.3}s`} 
                                            repeatCount="indefinite"/>
                                        <animateTransform
                                            attributeName="transform"
                                            type="rotate"
                                            values={`${60 * i} 240 125;${60 * i + 360} 240 125`}
                                            dur="8s"
                                            repeatCount="indefinite"
                                        />
                                    </circle>
                                ))}
                            </g>
                        )}
                    </g>
                )}

                {/* 캐릭터 본체 */}
                <g data-name="character-body">
                    <circle cx="125" cy="125.8" r="119.5" style={{ fill: styles.bodyFill }}></circle>
                    <ellipse cx="125" cy="108.3" rx="114" ry="102" style={{ fill: styles.highlightFill }}></ellipse>
                    <path
                        d="M125,10c30.7,0,59.6,12,81.3,33.7S240,94.3,240,125s-12,59.6-33.7,81.3S155.7,240,125,240s-59.6-12-81.3-33.7 S10,155.7,10,125s12-59.6,33.7-81.3S94.3,10,125,10 M125,0C56,0,0,56,0,125s56,125,125,125s125-56,125-125S194,0,125,0L125,0z"
                        style={{ fill: styles.strokeFill }}
                    ></path>
                    <g id="reflection">
                        <path d="M209.4,192.4c2.2-2.8,4.3-5.7,6.3-8.7" style={{ opacity: 0.25, fill: 'none', stroke: 'rgb(255, 255, 255)', strokeWidth: 14, strokeLinecap: 'round', strokeMiterlimit: 10 }}></path>
                        <path d="M159.2,226.7c3.2-1,6.4-2.2,9.5-3.5c3.1-1.3,6.1-2.8,9.1-4.4c3-1.6,5.9-3.4,8.7-5.3c2.8-1.9,5.6-4,8.2-6.2" style={{ opacity: 0.25, fill: 'none', stroke: 'rgb(255, 255, 255)', strokeWidth: 14, strokeLinecap: 'round', strokeMiterlimit: 10 }}></path>
                        <path d="M49,48.5c19-19,45.3-30.8,74.2-30.8" style={{ opacity: 0.5, fill: 'none', stroke: 'rgb(255, 255, 255)', strokeWidth: 14, strokeLinecap: 'round', strokeMiterlimit: 10 }}></path>
                    </g>
                </g>

                {/* 얼굴 */}
                <g data-name="face">
                    <path
                        data-name="mouth"
                        d="M 100 175 Q 125 185 150 175 Q 125 200 100 175 Z"
                        style={{ fill: styles.tongueFill, stroke: styles.strokeFill, strokeWidth: '5' }}
                    />
                    <g data-name="eyes">
                        <g data-name="left-eye-group">
                            <ellipse cx="65" cy="125.6" rx="26" ry="30.1" style={{ fill: 'white', stroke: styles.strokeFill, strokeWidth: 5 }} />
                            <g data-name="left-eye-pupil">
                                <ellipse cx="65" cy="125.6" rx="16" ry="18" style={{ fill: styles.strokeFill }} />
                                <ellipse cx="73" cy="117" rx="7" ry="5" style={{ fill: 'white' }} />
                            </g>
                            {/* ✨ 볼터치(Blusher)로 변경 */}
                            <ellipse cx="35" cy="158" rx="18" ry="12" fill="rgb(255, 127, 127)" opacity="0.6" />
                        </g>
                        <g data-name="right-eye-group">
                            <ellipse cx="185" cy="125.8" rx="26" ry="30.1" style={{ fill: 'white', stroke: styles.strokeFill, strokeWidth: 5 }} />
                            <g data-name="right-eye-pupil">
                                <ellipse cx="185" cy="125.8" rx="16" ry="18" style={{ fill: styles.strokeFill }} />
                                <ellipse cx="193" cy="117.8" rx="7" ry="5" style={{ fill: 'white' }} />
                            </g>
                            {/* ✨ 볼터치(Blusher)로 변경 */}
                            <ellipse cx="215" cy="158" rx="18" ry="12" fill="rgb(255, 127, 127)" opacity="0.6" />
                        </g>
                    </g>
                </g>

                {/* 왕관 */}
                {styles.showCrown && (
                    <g data-name="crown" transform="translate(-12.5, -40) scale(1.1)">
                        <path d="M 70 40 L 90 60 L 125 30 L 160 60 L 180 40 L 170 70 L 80 70 Z" fill={styles.strokeFill} transform="translate(2, 2)" opacity="0.4" />
                        <path d="M 70 40 L 90 60 L 125 30 L 160 60 L 180 40 L 170 70 L 80 70 Z" fill={styles.crownFill} stroke={styles.strokeFill} strokeWidth="5" />
                        {styles.showGem && !isMultiGemLevel && (
                            <circle cx="125" cy="55" r="8" fill={styles.gemFill} stroke={styles.strokeFill} strokeWidth="3" />
                        )}
                        {isMultiGemLevel && (
                            <g>
                                <circle cx="125" cy="55" r="8" fill={styles.gemFill} stroke={styles.strokeFill} strokeWidth="3" />
                                <circle cx="95" cy="62" r="7" fill={styles.gemFill} stroke={styles.strokeFill} strokeWidth="2.5" />
                                <circle cx="155" cy="62" r="7" fill={styles.gemFill} stroke={styles.strokeFill} strokeWidth="2.5" />
                            </g>
                        )}
                    </g>
                )}
            </g>
        </svg>
    );
};

// =======================================================================
// 3. 캐릭터 카드 컴포넌트
// =======================================================================
interface CharacterCardProps {
    level: number;
    rebirthCount: number;
    progress: number;
    xpInCurrentLevel: number;
    xpForNextLevel: number;
    totalExp: number;
    healthStatus?: {
        icon: string;
        status: string;
        message: string;
        color: string;
        lastUpdateText: string;
    } | null;
    pageCount?: number;
    isEmbedMode?: boolean; // **추가: 임베드 모드 여부**
}

const CharacterCard: React.FC<CharacterCardProps> = ({ 
    level, 
    rebirthCount, 
    progress, 
    xpInCurrentLevel, 
    xpForNextLevel, 
    totalExp, 
    healthStatus, 
    pageCount = 0,
    isEmbedMode = false // **추가: 기본값 false**
}) => {
    const [clickCount, setClickCount] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const cardRef = useRef<HTMLDivElement>(null);
    const characterRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const bounceTimeline = useRef<gsap.core.Timeline | null>(null);

    useLayoutEffect(() => {
        if (!characterRef.current || !cardRef.current || !svgRef.current) return;

        const q = gsap.utils.selector(svgRef.current);
        const pupils = q("[data-name='left-eye-pupil'], [data-name='right-eye-pupil']");
        const allElements = q("[data-name='character-container']");

        bounceTimeline.current?.kill();
        bounceTimeline.current = gsap.timeline({ repeat: -1, yoyo: true })
            .to(allElements, { y: 15, scaleX: 1.05, scaleY: 0.95, duration: 0.5, ease: "power1.in", transformOrigin: 'center bottom' })
            .to(allElements, { y: 0, scaleX: 1, scaleY: 1, duration: 0.5, ease: "power1.out", transformOrigin: 'center bottom' });

        const onMouseMove = (e: MouseEvent) => {
            if (!cardRef.current) return;
            const rect = cardRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const dx = (x - rect.width / 2) / (rect.width / 2);
            const dy = (y - rect.height / 2) / (rect.height / 2);
            gsap.to(pupils, { x: dx * 5, y: dy * 5, duration: 0.5, ease: 'power2.out' });
        };

        const onMouseLeave = () => {
            gsap.to(pupils, { x: 0, y: 0, duration: 0.5, ease: 'power2.out' });
        };

        const currentCardRef = cardRef.current;
        currentCardRef.addEventListener('mousemove', onMouseMove);
        currentCardRef.addEventListener('mouseleave', onMouseLeave);

        return () => {
            bounceTimeline.current?.kill();
            currentCardRef?.removeEventListener('mousemove', onMouseMove);
            currentCardRef?.removeEventListener('mouseleave', onMouseLeave);
        };
    }, [level]);

    const handleClick = () => {
        if (isAnimating || !svgRef.current) return;
    
        const q = gsap.utils.selector(svgRef.current);
        const animatedElements = q("[data-name='character-container']");
    
        setIsAnimating(true);
        setClickCount(prev => prev + 1);
        bounceTimeline.current?.pause();
    
        const onAnimationComplete = () => {
            gsap.set(animatedElements, { clearProps: "all" });
            setIsAnimating(false);
            bounceTimeline.current?.restart();
        };
    
        const animations = [
            () => {
                gsap.timeline({ onComplete: onAnimationComplete })
                    .to(animatedElements, { scaleY: 0.8, scaleX: 1.2, duration: 0.1, ease: 'power2.in', transformOrigin: 'center bottom' })
                    .set(animatedElements, { transformOrigin: 'center center' })
                    .to(animatedElements, { y: -90, rotation: 360, scaleY: 1, scaleX: 1, duration: 0.4, ease: 'power2.out' })
                    .set(animatedElements, { transformOrigin: 'center bottom' })
                    .to(animatedElements, { y: 0, duration: 0.3, ease: 'bounce.out' });
            },
            () => {
                gsap.timeline({ onComplete: onAnimationComplete })
                    .to(animatedElements, { x: -10, yoyo: true, repeat: 5, duration: 0.08, ease: 'power1.inOut' })
                    .to(animatedElements, { x: 0, duration: 0.2 });
            },
            () => {
                gsap.timeline({ onComplete: onAnimationComplete })
                    .to(animatedElements, { scaleY: 0.6, scaleX: 1.4, duration: 0.2, ease: 'power2.in', transformOrigin: 'center bottom' })
                    .to(animatedElements, { scaleY: 1.2, scaleX: 0.9, y: -20, duration: 0.15, ease: 'power1.out' })
                    .to(animatedElements, { scaleY: 1, scaleX: 1, y: 0, duration: 0.5, ease: 'bounce.out' });
            },
            () => {
                gsap.timeline({ onComplete: onAnimationComplete })
                    .to(animatedElements, { x: 2, yoyo: true, repeat: 10, duration: 0.05, ease: 'power1.inOut' })
                    .to(animatedElements, { x: 0, duration: 0.1 });
            }
        ];
    
        const randomIndex = Math.floor(Math.random() * animations.length);
        animations[randomIndex]();
    };

    const currentTheme = levelStyles[level] || levelStyles[1];
    
    // **수정: 임베드 모드일 때 그림자 제거**
    const shadowClass = isEmbedMode ? '' : 'shadow-2xl';

    return (
        <div ref={cardRef} className={`relative w-full max-w-sm mx-auto rounded-xl overflow-hidden border-4 ${shadowClass}`} style={{ borderColor: currentTheme.strokeFill, backgroundColor: currentTheme.highlightFill }}>
            <div className="p-4 border-b-2" style={{ borderColor: currentTheme.bodyFill }}>
                <p className="text-2xl font-bold text-white text-center" style={{ textShadow: `2px 2px 0px ${currentTheme.strokeFill}` }}>My Notion Pet</p>
                <div className="flex justify-between items-center mt-1 text-xs">
                    <span className="font-bold" style={{ color: currentTheme.strokeFill }}>Level: {level}</span>
                    <span className="font-bold" style={{ color: currentTheme.strokeFill }}>Rebirth: {rebirthCount}</span>
                </div>
            </div>
            <div className="p-4">
                {/* 건강 상태 표시 (캐릭터 위쪽) */}
                {healthStatus && (
                    <div className="mb-3 flex justify-center">
                        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border-2" 
                             style={{ 
                                 backgroundColor: currentTheme.highlightFill, 
                                 borderColor: currentTheme.strokeFill,
                                 color: currentTheme.strokeFill 
                             }}>
                            <span className="text-sm mr-1.5">{healthStatus.icon}</span>
                            <span className="font-bold">{healthStatus.status}</span>
                            <span className="mx-1.5 opacity-50">•</span>
                            <span className="text-xs opacity-75">{healthStatus.lastUpdateText}</span>
                        </div>
                    </div>
                )}

                <div ref={characterRef} onClick={handleClick} className="cursor-pointer w-40 h-40 mx-auto relative" title="Click me!">
                    {/* SVG 캐릭터 레이어 (날개와 마법진 모두 포함) */}
                    <div className="relative z-10">
                        <CharacterSVG svgRef={svgRef} level={level} />
                    </div>
                </div>
                <div className="mt-6 space-y-4 w-full px-4">
                    <div className="w-full bg-gray-200 rounded-full h-4" style={{ backgroundColor: currentTheme.bodyFill }}>
                        <div className="h-4 rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: currentTheme.strokeFill }}></div>
                    </div>
                    <div className="flex items-center justify-between text-xs" style={{ color: currentTheme.strokeFill }}>
                        <span>XP: {`${xpInCurrentLevel.toFixed(0)} / ${xpForNextLevel.toFixed(0)}`}</span>
                        <span>Total: {totalExp}</span>
                    </div>
                    
                    {/* 통계 정보 영역 - 컴팩트한 한 줄 레이아웃 */}
                    <div className="flex justify-center space-x-4">
                        <div className="flex items-center px-3 py-1.5 rounded-lg border-2" 
                             style={{ 
                                 backgroundColor: currentTheme.bodyFill, 
                                 borderColor: currentTheme.strokeFill,
                                 color: currentTheme.strokeFill 
                             }}>
                            <span className="text-xs font-medium mr-2">완료한 일</span>
                            <span className="font-bold text-sm">{pageCount}</span>
                        </div>
                        <div className="flex items-center px-3 py-1.5 rounded-lg border-2" 
                             style={{ 
                                 backgroundColor: currentTheme.bodyFill, 
                                 borderColor: currentTheme.strokeFill,
                                 color: currentTheme.strokeFill 
                             }}>
                            <span className="text-xs font-medium mr-2">상호작용</span>
                            <span className="font-bold text-sm">{clickCount}</span>
                        </div>
                    </div>

                    {/* 건강 상태 메시지 (하단) */}
                    {healthStatus && (
                        <div className="text-center">
                            <p className="text-xs italic opacity-80" style={{ color: currentTheme.strokeFill }}>
                                "{healthStatus.message}"
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CharacterCard;