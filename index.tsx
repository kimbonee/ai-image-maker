import React, { useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality } from '@google/genai';

const base64ToGenerativePart = (base64: string, mimeType: string) => {
    return {
        inlineData: { data: base64, mimeType: mimeType },
    }
}

// --- Main App Component ---
const App = () => {
  const [prompt, setPrompt] = useState('');
  const [imageStyle, setImageStyle] = useState('실사 이미지 (Photorealistic)');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [numCharacters, setNumCharacters] = useState(1);
  const [characterStyles, setCharacterStyles] = useState(['']);
  const [isImageLocked, setIsImageLocked] = useState(false);

  const [generatedImage, setGeneratedImage] = useState<{ b64: string, mimeType: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);

  const handleNumCharactersChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const count = parseInt(e.target.value, 10);
    setNumCharacters(count);
    // Adjust characterStyles array size, preserving existing styles
    setCharacterStyles(currentStyles => {
        const newStyles = [...currentStyles];
        while (newStyles.length < count) {
            newStyles.push('');
        }
        return newStyles.slice(0, count);
    });
  };

  const handleCharacterStyleChange = (index: number, value: string) => {
    setCharacterStyles(currentStyles => {
        const newStyles = [...currentStyles];
        newStyles[index] = value;
        return newStyles;
    });
  };

  const constructPrompt = useCallback(() => {
    let fullPrompt = `${prompt}. 이미지 스타일: ${imageStyle}.`;
    if (numCharacters > 0) {
        fullPrompt += ` 등장인물 ${numCharacters}명.`;
        characterStyles.forEach((style, index) => {
            if (style.trim()) {
                fullPrompt += ` 등장인물 ${index + 1} 스타일: ${style}.`;
            }
        });
    }
    return fullPrompt;
  }, [prompt, imageStyle, numCharacters, characterStyles]);

  const generateImage = async () => {
    if (!prompt) {
      setError('프롬프트를 입력해주세요.');
      return;
    }
    setIsLoading(true);
    setError(null);
    
    // Don't clear the image immediately, so the user can see the old one while loading
    // setGeneratedImage(null); 

    const fullPrompt = constructPrompt();

    try {
        // If image is locked and a previous image exists, use the editing model
        if (isImageLocked && generatedImage) {
            const imagePart = base64ToGenerativePart(generatedImage.b64, generatedImage.mimeType);
            const textPart = { text: fullPrompt };
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [imagePart, textPart] },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            const imageResponsePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
            if (imageResponsePart?.inlineData) {
                 setGeneratedImage({
                    b64: imageResponsePart.inlineData.data,
                    mimeType: imageResponsePart.inlineData.mimeType,
                 });
            } else {
                throw new Error('캐릭터 일관성을 유지한 이미지 생성에 실패했습니다. 이미지 고정을 해제하고 다시 시도해보세요.');
            }

        } else {
             // Otherwise, generate a new image
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: fullPrompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                    aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
                },
            });
            
            if (response.generatedImages && response.generatedImages.length > 0) {
                const b64 = response.generatedImages[0].image.imageBytes;
                setGeneratedImage({ b64, mimeType: 'image/png'});
            } else {
                throw new Error('이미지 생성에 실패했습니다.');
            }
        }
    } catch (e: any) {
      setError(`오류가 발생했습니다: ${e.message}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = `data:${generatedImage.mimeType};base64,${generatedImage.b64}`;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="container">
      <header>
        <h1>AI 이미지 생성기 (Nano-Banana)</h1>
        <p>프롬프트와 옵션을 선택하여 이미지를 생성하고, '이미지 고정'으로 캐릭터의 일관성을 유지해보세요.</p>
      </header>
      <main>
        <div className="controls">
            <h2>옵션 설정</h2>
            <div className="form-group">
                <label htmlFor="prompt">프롬프트</label>
                <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="예: 우주복을 입고 달에서 스케이트보드를 타는 고양이"
                    rows={4}
                    aria-label="Main prompt for image generation"
                />
            </div>

            <div className="grid-2">
                <div className="form-group">
                    <label htmlFor="image-style">이미지 스타일</label>
                    <select id="image-style" value={imageStyle} onChange={(e) => setImageStyle(e.target.value)}>
                        <option>실사 이미지 (Photorealistic)</option>
                        <option>애니메이션 (Anime)</option>
                        <option>수채화 (Watercolor)</option>
                        <option>픽셀 아트 (Pixel Art)</option>
                        <option>판타지 (Fantasy Art)</option>
                        <option>사이버펑크 (Cyberpunk)</option>
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="aspect-ratio">사진 비율</label>
                    <select id="aspect-ratio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isImageLocked && !!generatedImage}>
                        <option>16:9</option>
                        <option>9:16</option>
                        <option>1:1</option>
                        <option>4:3</option>
                        <option>3:4</option>
                    </select>
                </div>
            </div>

            <div className="form-group">
                <label htmlFor="num-characters">등장인물 수</label>
                <select id="num-characters" value={numCharacters} onChange={handleNumCharactersChange}>
                    {[1, 2, 3, 4, 5].map(num => <option key={num} value={num}>{num}명</option>)}
                </select>
            </div>

            {characterStyles.map((style, index) => (
                <div className="form-group character-style" key={index}>
                    <label htmlFor={`char-style-${index}`}>등장인물 {index + 1} 스타일</label>
                    <input
                        type="text"
                        id={`char-style-${index}`}
                        value={style}
                        onChange={(e) => handleCharacterStyleChange(index, e.target.value)}
                        placeholder={`예: 파란 눈의 금발 여기사`}
                    />
                </div>
            ))}

            <div className="form-group checkbox-group">
                <input
                    type="checkbox"
                    id="image-lock"
                    checked={isImageLocked}
                    onChange={(e) => setIsImageLocked(e.target.checked)}
                    disabled={!generatedImage}
                />
                <label htmlFor="image-lock">이미지 고정 (캐릭터 일관성 유지)</label>
            </div>

            <button onClick={generateImage} disabled={isLoading} className="generate-btn" aria-label="Generate image based on current settings">
                {isLoading ? '생성 중...' : '이미지 생성'}
            </button>
        </div>
        <div className="results" aria-live="polite">
            {isLoading && (
                <div className="loader-container">
                    <div className="loader"></div>
                    <p>이미지를 생성하고 있습니다. 잠시만 기다려주세요...</p>
                </div>
            )}
            {error && <div className="error-message" role="alert">{error}</div>}
            {generatedImage && !isLoading && (
                <div className="image-container">
                    <img src={`data:${generatedImage.mimeType};base64,${generatedImage.b64}`} alt="Generated image based on the prompt" />
                    <button onClick={downloadImage} className="download-btn" aria-label="Download generated image">
                        다운로드
                    </button>
                </div>
            )}
             {!generatedImage && !isLoading && !error && (
                <div className="placeholder">
                    <p>생성된 이미지가 여기에 표시됩니다.</p>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);
