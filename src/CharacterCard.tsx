import React, { useState, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';

// =======================================================================
// 1. 캐릭터 스타일 정의 (From Reference)
// =======================================================================
const levelStyles: { [key: number]: any } = {
    1: { bodyFill: 'rgb(251, 113, 133)', highlightFill: 'rgb(253, 164, 175)', strokeFill: 'rgb(136, 19, 55)', tongueFill: 'rgb(220, 20, 60)', showCrown: false, showGem: false, showCape: false, showAura: false },
    2: { bodyFill: '#87CEEB', highlightFill: '#B0E0E6', strokeFill: '#4682B4', tongueFill: '#FF6347', showCrown: false, showGem: false, showCape: false, showAura: false },
    3: { bodyFill: '#87CEEB', highlightFill: '#B0E0E6', strokeFill: '#4682B4', tongueFill: '#FF6347', showCrown: true, crownFill: '#FFD700', showGem: false, showCape: false, showAura: false },
    4: { bodyFill: '#90EE90', highlightFill: '#98FB98', strokeFill: '#2E8B57', tongueFill: '#FF7F50', showCrown: true, crownFill: '#FFD700', showGem: false, showCape: false, showAura: false },
    5: { bodyFill: '#90EE90', highlightFill: '#98FB98', strokeFill: '#2E8B57', tongueFill: '#FF7F50', showCrown: true, crownFill: '#FFD700', showGem: true, gemFill: '#FF4500', showCape: false, showAura: false },
    6: { bodyFill: '#FFD700', highlightFill: '#FFFACD', strokeFill: '#B8860B', tongueFill: '#E9967A', showCrown: true, crownFill: '#C0C0C0', showGem: true, gemFill: '#FF4500', showCape: true, capeFill: '#DC143C', showAura: false },
    7: { bodyFill: '#FFD700', highlightFill: '#FFFACD', strokeFill: '#B8860B', tongueFill: '#E9967A', showCrown: true, crownFill: '#C0C0C0', showGem: true, gemFill: '#00FFFF', showCape: true, capeFill: '#DC143C', showAura: false },
    8: { bodyFill: '#E6E6FA', highlightFill: '#FFFFFF', strokeFill: '#9370DB', tongueFill: '#F08080', showCrown: true, crownFill: '#FFD700', showGem: true, gemFill: '#00FFFF', showCape: true, capeFill: '#483D8B', showAura: false },
    9: { bodyFill: '#E6E6FA', highlightFill: '#FFFFFF', strokeFill: '#9370DB', tongueFill: '#F08080', showCrown: true, crownFill: '#FFD700', showGem: true, gemFill: '#DA70D6', showCape: true, capeFill: '#483D8B', showAura: true, auraFill: 'gold' },
    10: { bodyFill: '#D3D3D3', highlightFill: '#F5F5F5', strokeFill: '#696969', tongueFill: '#B22222', showCrown: true, crownFill: '#FFD700', showGem: true, gemFill: '#DA70D6', showCape: true, capeFill: '#A9A9A9', showAura: true, auraFill: 'url(#rainbowAura)' },
};


// =======================================================================
// 2. 캐릭터 SVG 컴포넌트 (From Reference)
// =======================================================================
const CharacterSVG: React.FC<{ svgRef: React.Ref<SVGSVGElement>, level: number }> = ({ svgRef, level }) => {
    const styles = levelStyles[level] || levelStyles[1];
    const isMultiGemLevel = level >= 7;

    return (
        <svg
            ref={svgRef}
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 250 250"
            className="w-full h-full overflow-visible"
        >
            <defs>
                <linearGradient id="rainbowAura" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="red" />
                    <stop offset="20%" stopColor="orange" />
                    <stop offset="40%" stopColor="yellow" />
                    <stop offset="60%" stopColor="green" />
                    <stop offset="80%" stopColor="blue" />
                    <stop offset="100%" stopColor="purple" />
                </linearGradient>
            </defs>
            <g data-name="character-container">
                {styles.showAura && (
                    <g data-name="aura">
                        <ellipse cx="125" cy="125.8" rx="166" ry="166" fill={styles.auraFill} />
                    </g>
                )}

                {styles.showCape && (
                    <g data-name="cape">
                        <path d="M 80 130 C 60 220, 190 220, 170 130 L 125 150 Z" fill={styles.capeFill} stroke={styles.strokeFill} strokeWidth="5" />
                    </g>
                )}

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
                            <path d="M45, 156 q 20 15 40 0" style={{ fill: 'none', strokeWidth: 8, strokeLinecap: 'round', strokeMiterlimit: 10, stroke: styles.bodyFill }}></path>
                        </g>
                        <g data-name="right-eye-group">
                            <ellipse cx="185" cy="125.8" rx="26" ry="30.1" style={{ fill: 'white', stroke: styles.strokeFill, strokeWidth: 5 }} />
                            <g data-name="right-eye-pupil">
                                <ellipse cx="185" cy="125.8" rx="16" ry="18" style={{ fill: styles.strokeFill }} />
                                <ellipse cx="193" cy="117.8" rx="7" ry="5" style={{ fill: 'white' }} />
                            </g>
                            <path d="M165, 156 q 20 15 40 0" style={{ fill: 'none', strokeWidth: 8, strokeLinecap: 'round', strokeMiterlimit: 10, stroke: styles.bodyFill }}></path>
                        </g>
                    </g>
                </g>
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
}

const CharacterCard: React.FC<CharacterCardProps> = ({ level, rebirthCount, progress, xpInCurrentLevel, xpForNextLevel, totalExp }) => {
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

    // ✨ 클릭 핸들러 (참고 파일 기반으로 재작성)
    const handleClick = () => {
        if (isAnimating || !svgRef.current) return;
    
        const q = gsap.utils.selector(svgRef.current);
        // ✨ 애니메이션 대상을 전체 그룹으로 통일하여 위치 오류 방지
        const animatedElements = q("[data-name='character-container']");
    
        setIsAnimating(true);
        setClickCount(prev => prev + 1);
        bounceTimeline.current?.pause();
    
        // ✨ 애니메이션 완료 후 transform 속성을 깨끗하게 초기화하는 것이 중요
        const onAnimationComplete = () => {
            gsap.set(animatedElements, { clearProps: "all" });
            setIsAnimating(false);
            bounceTimeline.current?.restart();
        };
    
        const animations = [
            () => { // 점프 & 회전
                gsap.timeline({ onComplete: onAnimationComplete })
                    .to(animatedElements, { scaleY: 0.8, scaleX: 1.2, duration: 0.1, ease: 'power2.in', transformOrigin: 'center bottom' })
                    .to(animatedElements, { y: -90, rotation: 360, scaleY: 1, scaleX: 1, duration: 0.4, ease: 'power2.out', transformOrigin: 'center center' })
                    .to(animatedElements, { y: 0, duration: 0.3, ease: 'bounce.out', transformOrigin: 'center bottom' });
            },
            () => { // 좌우 흔들기
                gsap.timeline({ onComplete: onAnimationComplete })
                    .to(animatedElements, { x: -10, yoyo: true, repeat: 5, duration: 0.08, ease: 'power1.inOut' })
                    .to(animatedElements, { x: 0, duration: 0.2 });
            },
            () => { // 꾹 눌렸다 튀어오르기
                gsap.timeline({ onComplete: onAnimationComplete })
                    .to(animatedElements, { scaleY: 0.6, scaleX: 1.4, duration: 0.2, ease: 'power2.in', transformOrigin: 'center bottom' })
                    .to(animatedElements, { scaleY: 1.2, scaleX: 0.9, y: -20, duration: 0.15, ease: 'power1.out' })
                    .to(animatedElements, { scaleY: 1, scaleX: 1, y: 0, duration: 0.5, ease: 'bounce.out' });
            },
            () => { // 부르르 떨기
                gsap.timeline({ onComplete: onAnimationComplete })
                    .to(animatedElements, { x: 2, yoyo: true, repeat: 10, duration: 0.05, ease: 'power1.inOut' })
                    .to(animatedElements, { x: 0, duration: 0.1 });
            }
        ];
    
        const randomIndex = Math.floor(Math.random() * animations.length);
        animations[randomIndex]();
    };

    const currentTheme = levelStyles[level] || levelStyles[1];

    return (
        <div ref={cardRef} className="relative w-full max-w-sm mx-auto rounded-xl shadow-2xl overflow-hidden border-4" style={{ borderColor: currentTheme.strokeFill, backgroundColor: currentTheme.highlightFill }}>
            <div className="p-4 border-b-2" style={{ borderColor: currentTheme.bodyFill }}>
                <p className="text-2xl font-bold text-white text-center" style={{ textShadow: `2px 2px 0px ${currentTheme.strokeFill}` }}>My Notion Pet</p>
                <div className="flex justify-between items-center mt-1 text-xs">
                    <span className="font-bold" style={{ color: currentTheme.strokeFill }}>Level: {level}</span>
                    <span className="font-bold" style={{ color: currentTheme.strokeFill }}>Rebirth: {rebirthCount}</span>
                </div>
            </div>
            <div className="p-4">
                <div ref={characterRef} onClick={handleClick} className="cursor-pointer w-40 h-40 mx-auto" title="Click me!">
                    <CharacterSVG svgRef={svgRef} level={level} />
                </div>
                <div className="mt-6 space-y-4 w-full px-4">
                    <div className="w-full bg-gray-200 rounded-full h-4" style={{ backgroundColor: currentTheme.bodyFill }}>
                        <div className="h-4 rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: currentTheme.strokeFill }}></div>
                    </div>
                    <div className="flex items-center justify-between text-xs" style={{ color: currentTheme.strokeFill }}>
                        <span>XP: {`${xpInCurrentLevel.toFixed(0)} / ${xpForNextLevel.toFixed(0)}`}</span>
                        <span>Total: {totalExp}</span>
                    </div>
                     <div className="text-center">
                        <span className="inline-block px-3 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: currentTheme.bodyFill, color: currentTheme.strokeFill }}>
                            Interactions: {clickCount}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CharacterCard;

