# kimP 프로젝트 문서 (Documentation)

## 개요 (Overview)

이 디렉토리는 kimP 프로젝트의 모든 문서를 포함합니다. 각 문서는 프로젝트의 특정 측면에 대한 상세한 정보를 제공합니다.

---

## 📚 문서 목록 (Document List)

### 1. [API 문서](./API_DOCUMENTATION.md)

**설명**: kimP 시스템의 주요 서비스들의 API 인터페이스와 사용법을 설명합니다.

**주요 내용**:

- 설정 관리 서비스 (InvestmentConfigService)
- 포트폴리오 관리 서비스 (PortfolioManagerService)
- 차익거래 핵심 서비스 (ArbitrageFlowManagerService, HighPremiumProcessorService, LowPremiumProcessorService)
- 세션 관리 서비스 (SessionManagerService, SessionExecutorService, SessionStateService)
- 거래 실행 서비스 (ExchangeService, StrategyHighService, StrategyLowService)
- 계산 서비스 (FeeCalculatorService, SlippageCalculatorService, SpreadCalculatorService)
- 데이터베이스 서비스 (ArbitrageRecordService, PortfolioLogService)
- 알림 서비스 (TelegramService, NotificationComposerService)
- 모니터링 서비스 (DepositMonitorService, SessionFundValidationService)
- 거래소별 서비스 (BinanceService, UpbitService)

**최근 업데이트**:

- StrategyLowService.handleLowPremiumFlow 반환 타입 변경
- 입금 확인 로직 개선 (50% 기준, 입금 내역 API 통합)
- stepSize 조정 로직 개선
- Reverse 모드 세션 상태 관리 추가
- BinanceService.getSymbolInfo 메서드 추가
- ExchangeService.getSymbolInfo 메서드 추가

**대상 독자**: 개발자, 시스템 통합자

---

### 2. [아키텍처 문서](./ARCHITECTURE.md)

**설명**: 시스템의 전체 아키텍처, 설계 원칙, 그리고 주요 컴포넌트들의 상호작용을 설명합니다.

**주요 내용**:

- 시스템 아키텍처 개요 (4계층 구조)
- 핵심 설계 원칙 (모듈화, 의존성 주입, 인터페이스 기반 설계, 상태 관리 중앙화)
- 모듈 아키텍처 (의존성 다이어그램, 주요 모듈 설명)
- 데이터 흐름 (실시간 가격 데이터, 세션 기반 병렬 처리, Reverse 모드 데이터 흐름, 데이터 영속성)
- 성능 최적화 아키텍처 (캐싱 전략, 배치 처리, 비동기 처리, API 호출 최적화)
- 보안 아키텍처 (API 키 관리, 에러 처리)
- 확장성 아키텍처 (모듈 확장성, 세션 확장성, Reverse 모드 확장성, 데이터베이스 확장성)
- 모니터링 아키텍처 (성능 모니터링, 비즈니스 모니터링, 세션 상태 모니터링)
- 테스트 아키텍처 (단위 테스트, 통합 테스트, Reverse 모드 테스트)
- 배포 아키텍처 (환경별 설정, 컨테이너화)
- 장애 복구 아키텍처 (자동 복구 메커니즘, 세션 복구 메커니즘, 데이터 백업)
- 성능 지표 (시스템 성능, 비즈니스 성능, Reverse 모드 성능 지표)
- 최근 개선사항 (세션 상태 관리 개선, 입금 확인 로직 개선, stepSize 조정 로직 개선, 에러 처리 개선)

**최근 업데이트**:

- Reverse 모드 아키텍처 추가
- 세션 상태 관리 개선
- 입금 확인 로직 개선
- stepSize 조정 로직 개선
- 에러 처리 개선

**대상 독자**: 시스템 아키텍트, 개발자, 운영자

---

### 3. [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)

**설명**: kimP 시스템에서 수행된 성능 최적화 작업과 그 효과를 상세히 설명합니다.

**주요 내용**:

- 최적화 전 시스템 상태 (성능 이슈, 성능 지표)
- 최적화 전략 (캐싱 전략, 코드 중복 제거, API 호출 최적화, 세션 상태 관리 최적화, 배치 처리, 모듈 의존성 정리)
- 최적화 효과 (성능 개선 지표, 코드 품질 개선)
- 구현 세부사항 (캐싱 구현, 에러 처리, 성능 모니터링)
- 최적화 검증 (성능 테스트, 기능 테스트)
- 향후 최적화 계획 (API 호출 최적화, 데이터베이스 최적화, 메모리 최적화, Reverse 모드 최적화)
- 모니터링 및 알림 (성능 모니터링, 알림 시스템)
- 결론 (최적화 성과, 주요 개선사항, 다음 단계)

**최근 업데이트**:

- API 호출 최적화 섹션 추가
- 세션 상태 관리 최적화 섹션 추가
- stepSize 조정 최적화 내용 추가
- 입금 확인 로직 개선 내용 추가
- 성능 지표 업데이트
- 최적화 검증 섹션 확장

**대상 독자**: 개발자, 성능 엔지니어, 시스템 관리자

---

## 🎯 문서 사용 가이드 (Documentation Usage Guide)

### 개발자를 위한 가이드

1. **새로운 기능 개발 시**:

   - [아키텍처 문서](./ARCHITECTURE.md)에서 시스템 구조 파악
   - [API 문서](./API_DOCUMENTATION.md)에서 관련 서비스 인터페이스 확인
   - [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)에서 최적화 패턴 참고

2. **기존 코드 수정 시**:

   - [API 문서](./API_DOCUMENTATION.md)에서 서비스 간 의존성 확인
   - [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)에서 캐싱 전략 확인
   - [아키텍처 문서](./ARCHITECTURE.md)에서 모듈 구조 확인

3. **성능 문제 해결 시**:

   - [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)에서 최적화 기법 참고
   - [아키텍처 문서](./ARCHITECTURE.md)에서 모니터링 방법 확인

4. **Reverse 모드 개발 시**:
   - [아키텍처 문서](./ARCHITECTURE.md)에서 Reverse 모드 데이터 흐름 확인
   - [API 문서](./API_DOCUMENTATION.md)에서 세션 상태 관리 API 확인
   - [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)에서 세션 상태 관리 최적화 참고

### 운영자를 위한 가이드

1. **시스템 모니터링**:

   - [아키텍처 문서](./ARCHITECTURE.md)에서 모니터링 포인트 확인
   - [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)에서 성능 지표 확인

2. **문제 해결**:

   - [API 문서](./API_DOCUMENTATION.md)에서 서비스 동작 방식 파악
   - [아키텍처 문서](./ARCHITECTURE.md)에서 장애 복구 방법 확인

3. **Reverse 모드 운영**:
   - [아키텍처 문서](./ARCHITECTURE.md)에서 Reverse 모드 성능 지표 확인
   - [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)에서 세션 성공률 모니터링 확인

### 관리자를 위한 가이드

1. **시스템 이해**:

   - [아키텍처 문서](./ARCHITECTURE.md)에서 전체 시스템 구조 파악
   - [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)에서 성능 개선 효과 확인

2. **개발 계획**:
   - [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)에서 향후 최적화 계획 확인
   - [아키텍처 문서](./ARCHITECTURE.md)에서 확장성 계획 확인

---

## 📋 문서 업데이트 가이드 (Documentation Update Guide)

### 문서 업데이트 원칙

1. **일관성**: 모든 문서는 동일한 형식과 스타일을 유지
2. **정확성**: 코드 변경 시 관련 문서도 함께 업데이트
3. **완전성**: 새로운 기능 추가 시 관련 문서도 함께 작성
4. **가독성**: 명확하고 이해하기 쉬운 설명 제공

### 문서 업데이트 체크리스트

- [ ] 코드 변경 사항이 문서에 반영되었는가?
- [ ] 새로운 API나 서비스가 문서화되었는가?
- [ ] 성능 개선 사항이 성능 최적화 문서에 기록되었는가?
- [ ] 아키텍처 변경 사항이 아키텍처 문서에 반영되었는가?
- [ ] 문서 간 일관성이 유지되었는가?
- [ ] 버전 정보가 업데이트되었는가?

### 최근 주요 업데이트 (v1.1)

#### **세션 상태 관리 개선**

- StrategyLowService.handleLowPremiumFlow 반환 타입 변경
- SessionExecutorService 결과 처리 로직 추가
- Reverse 모드 세션 상태 추가

#### **입금 확인 로직 개선**

- 입금 확인 기준 변경 (95% → 50%)
- 입금 내역 API 통합
- 상세 로깅 추가

#### **stepSize 조정 로직 개선**

- BinanceService.getSymbolInfo 메서드 추가
- ExchangeService.getSymbolInfo 메서드 추가
- 잔고 초과 방지 로직 구현

#### **에러 처리 개선**

- 소수점 정밀도 오류 해결
- 재시도 로직 개선
- 에러 분류 (치명적/일시적)

---

## 🔗 관련 링크 (Related Links)

### 프로젝트 메인 문서

- [프로젝트 README](../README.md) - 프로젝트 개요 및 설치 가이드
- [사용자 가이드](../READMESUN.md) - 사용자를 위한 간단한 설명서
- [AI 규칙](../.cursor-rules.md) - AI 개발 가이드라인

### 외부 리소스

- [NestJS 공식 문서](https://docs.nestjs.com/) - NestJS 프레임워크 문서
- [TypeORM 문서](https://typeorm.io/) - 데이터베이스 ORM 문서
- [TypeScript 문서](https://www.typescriptlang.org/docs/) - TypeScript 언어 문서

---

## 📞 문서 관련 문의 (Documentation Inquiries)

문서에 대한 질문이나 개선 제안이 있으시면 다음 방법으로 문의해 주세요:

1. **GitHub Issues**: 프로젝트 저장소에 이슈 생성
2. **개발팀 문의**: 직접 개발팀에 문의

---

## 📝 문서 버전 정보 (Documentation Version Info)

| 문서             | 버전 | 마지막 업데이트 | 주요 변경사항                                           |
| ---------------- | ---- | --------------- | ------------------------------------------------------- |
| API 문서         | v1.1 | 2025-01-27      | Reverse 모드 지원, 세션 상태 관리 개선, API 호출 최적화 |
| 아키텍처 문서    | v1.1 | 2025-01-27      | Reverse 모드 아키텍처, 세션 상태 관리, API 호출 최적화  |
| 성능 최적화 문서 | v1.1 | 2025-01-27      | API 호출 최적화, 세션 상태 관리, stepSize 조정 최적화   |

### 버전별 주요 변경사항

#### **v1.0 (초기 버전)**

- 기본 API 문서 작성
- 시스템 아키텍처 문서 작성
- 성능 최적화 문서 작성

#### **v1.1 (최신 버전)**

- **Reverse 모드 지원**: 양방향 차익거래 모드 추가
- **세션 상태 관리 개선**: 명확한 성공/실패 판단 로직
- **API 호출 최적화**: stepSize 조정 및 잔고 초과 방지
- **입금 확인 로직 개선**: 50% 기준 및 입금 내역 API 통합
- **에러 처리 개선**: 소수점 정밀도 오류 해결

---

## 🚀 빠른 시작 (Quick Start)

### 새로운 개발자라면

1. **시스템 이해**: [아키텍처 문서](./ARCHITECTURE.md)부터 읽기
2. **API 파악**: [API 문서](./API_DOCUMENTATION.md)에서 서비스 인터페이스 확인
3. **최적화 패턴**: [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)에서 최적화 기법 학습

### Reverse 모드 개발

1. **데이터 흐름**: [아키텍처 문서](./ARCHITECTURE.md)의 "Reverse 모드 데이터 흐름" 섹션 확인
2. **API 사용법**: [API 문서](./API_DOCUMENTATION.md)의 "세션 관리 서비스" 섹션 확인
3. **최적화 기법**: [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)의 "세션 상태 관리 최적화" 섹션 확인

### 성능 문제 해결

1. **성능 지표**: [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)의 "최적화 효과" 섹션 확인
2. **모니터링**: [아키텍처 문서](./ARCHITECTURE.md)의 "모니터링 아키텍처" 섹션 확인
3. **최적화 기법**: [성능 최적화 문서](./PERFORMANCE_OPTIMIZATION.md)의 "최적화 전략" 섹션 확인

---

> **마지막 업데이트**: 2025년 7월 21일
> **문서 관리자**: kimP 개발팀
> **현재 버전**: v1.1
