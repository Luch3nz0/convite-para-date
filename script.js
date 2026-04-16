const STORAGE_KEY = "convite-date-ticket:v1";
const INTRO_STEPS = [
  "Uma missão urbana e muito importante chegou até você. O prêmio final é raro, dourado e oficialmente charmoso.",
  "Para desbloquear seu Date Ticket, basta acertar cinco perguntas. Divirta-se!",
];

const QUESTIONS = [
  {
    id: 1,
    prompt: "Quem é o artista deste quadro?",
    image: "./klimt.png",
    choices: ["Gustav Klimt", "Egon Schiele", "Alphonse Mucha"],
    correctAnswer: "Gustav Klimt",
    feedback: "Acerto impecável. O ouro do ticket brilhou um pouco mais.",
  },
  {
    id: 2,
    prompt: "Qual é o nome deste mosaico bizantino?",
    image: "./imperadorjustiano.png",
    choices: [
      "Imperador Justiniano e sua comitiva",
      "Imperatriz Teodora e sua corte",
      "Cristo Pantocrator",
    ],
    correctAnswer: "Imperador Justiniano e sua comitiva",
    feedback: "Resposta digna de Ravenna. O desafio continua elegante.",
  },
  {
    id: 3,
    prompt: "Come si chiama la sirena di Napoli?",
    image: "./parthenope.png",
    choices: ["Partenope", "Lighea", "Aretusa"],
    correctAnswer: "Partenope",
    feedback: "Perfetto. Napoli aprovou oficialmente esse acerto.",
    note: "Essa pergunta aparece em italiano de propósito, para manter o charme.",
  },
  {
    id: 4,
    prompt: "Quem é o arquiteto desta construção?",
    image: "./frankgehry.png",
    choices: ["Frank Gehry", "Zaha Hadid", "Le Corbusier"],
    correctAnswer: "Frank Gehry",
    feedback: "Mais um ponto. Esse ticket já está quase saindo do forno.",
  },
  {
    id: 5,
    prompt: "Qual é o nome deste filme?",
    image: "./7thseal.png",
    choices: ["O Sétimo Selo", "Morangos Silvestres", "Persona"],
    correctAnswer: "O Sétimo Selo",
    feedback: "Xeque-mate no quiz. O Date Ticket foi desbloqueado.",
  },
];

const TICKET_PERKS = [
  "Amendoim japonês em modo premium",
  "Filminho + cobertas no pacote principal",
  "Ar-condicionado trincando com carinho garantido",
  "Bônus secreto liberado: bitocas",
];

const REPLY_MESSAGES = {
  yes: "Eu aceito oficialmente meu Date Ticket. Vamos marcar o resgate? 💛",
  negotiate: "Eu topo, mas quero negociar os detalhes do meu Date Ticket com você 😌",
};

const WHATSAPP_NUMBER = "5511999200415";

const DEFAULT_STATE = {
  screen: "home",
  ticketUnlocked: false,
  currentQuestionIndex: 0,
  gameStarted: false,
  quizCompleted: false,
  lastResult: null,
  introStep: 0,
  choiceOrders: {},
};

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

let state = loadState();
let toastTimer = null;
let typewriterTimer = null;
let currentTyping = null;

render();

app.addEventListener("click", async (event) => {
  const actionTarget = event.target.closest("[data-action]");

  if (!actionTarget) {
    return;
  }

  const { action } = actionTarget.dataset;

  if (action === "start-game") {
    startGame();
    return;
  }

  if (action === "continue-intro") {
    advanceIntro();
    return;
  }

  if (action === "skip-intro") {
    finishIntro();
    return;
  }

  if (action === "go-home") {
    stopTyping();
    state.screen = "home";
    persist();
    render();
    return;
  }

  if (action === "retry-game") {
    initializeGame({ skipIntro: true });
    return;
  }

  if (action === "view-ticket") {
    if (!state.ticketUnlocked) {
      return;
    }

    state.screen = "ticket";
    persist();
    render();
    return;
  }

  if (action === "reset-progress") {
    resetProgress();
    return;
  }

  if (action === "answer") {
    const selectedChoice = actionTarget.dataset.choice;
    handleAnswer(selectedChoice);
    return;
  }

  if (action === "flip-ticket") {
    const ticket = app.querySelector("[data-ticket]");

    if (ticket) {
      ticket.classList.toggle("ticket-card--flipped");
    }

    return;
  }

  if (action === "reply") {
    await handleReply(actionTarget.dataset.replyKind);
  }
});

window.addEventListener("beforeunload", () => {
  stopTyping();
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return structuredClone(DEFAULT_STATE);
    }

    const parsed = JSON.parse(raw);

    return sanitizeState(parsed);
  } catch (error) {
    return structuredClone(DEFAULT_STATE);
  }
}

function sanitizeState(parsed) {
  const merged = {
    ...structuredClone(DEFAULT_STATE),
    ...parsed,
  };

  if (!merged.ticketUnlocked && merged.screen === "ticket") {
    merged.screen = "home";
  }

  if (
    typeof merged.currentQuestionIndex !== "number" ||
    merged.currentQuestionIndex < 0 ||
    merged.currentQuestionIndex > QUESTIONS.length
  ) {
    merged.currentQuestionIndex = 0;
  }

  if (!merged.choiceOrders || typeof merged.choiceOrders !== "object") {
    merged.choiceOrders = {};
  }

  return merged;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function startGame() {
  if (state.gameStarted && !state.quizCompleted) {
    if (!state.choiceOrders || Object.keys(state.choiceOrders).length === 0) {
      state.choiceOrders = buildChoiceOrders();
      persist();
    }

    state.screen = state.screen === "home" ? (state.introStep < INTRO_STEPS.length ? "intro" : "quiz") : state.screen;
    persist();
    render();
    return;
  }

  initializeGame();
}

function initializeGame({ skipIntro = false } = {}) {
  stopTyping();
  const preservedTicket = state.ticketUnlocked;

  state = {
    ...structuredClone(DEFAULT_STATE),
    ticketUnlocked: preservedTicket,
    choiceOrders: buildChoiceOrders(),
    gameStarted: true,
    screen: skipIntro ? "quiz" : "intro",
    introStep: skipIntro ? INTRO_STEPS.length : 0,
  };

  persist();
  render();
}

function buildChoiceOrders() {
  return QUESTIONS.reduce((orders, question) => {
    orders[question.id] = shuffle(question.choices);
    return orders;
  }, {});
}

function shuffle(items) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
}

function advanceIntro() {
  if (currentTyping && !currentTyping.done) {
    finishTyping();
    return;
  }

  if (state.introStep < INTRO_STEPS.length - 1) {
    state.introStep += 1;
    persist();
    render();
    return;
  }

  finishIntro();
}

function finishIntro() {
  stopTyping();
  state.introStep = INTRO_STEPS.length;
  state.screen = "quiz";
  persist();
  render();
}

function handleAnswer(choice) {
  if (state.screen !== "quiz") {
    return;
  }

  const question = QUESTIONS[state.currentQuestionIndex];
  const correct = choice === question.correctAnswer;

  if (!correct) {
    showToast("Quase. O ticket escapou dessa vez.", "error");
    state.lastResult = "fail";
    state.gameStarted = false;
    state.quizCompleted = false;
    state.currentQuestionIndex = 0;
    state.introStep = 0;
    state.screen = "fail";
    persist();

    window.setTimeout(render, 420);
    return;
  }

  showToast(question.feedback, "success");
  state.lastResult = "success";

  if (state.currentQuestionIndex === QUESTIONS.length - 1) {
    state.ticketUnlocked = true;
    state.quizCompleted = true;
    state.gameStarted = false;
    state.currentQuestionIndex = QUESTIONS.length;
    state.screen = "success";
    persist();

    window.setTimeout(render, 650);
    return;
  }

  state.currentQuestionIndex += 1;
  persist();

  window.setTimeout(render, 520);
}

function resetProgress() {
  const accepted = window.confirm(
    "Isso apaga o ticket desbloqueado e reinicia a missão. Deseja continuar?",
  );

  if (!accepted) {
    return;
  }

  stopTyping();
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(DEFAULT_STATE);
  showToast("Progresso apagado. A missão voltou ao início.", "success");
  render();
}

async function handleReply(kind) {
  const message = REPLY_MESSAGES[kind];

  if (!message) {
    return;
  }

  const fullMessage = `${message}\n${window.location.href}`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(fullMessage)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  showToast("WhatsApp aberto com a mensagem pronta.", "success");
}

function showToast(message, tone = "success") {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast toast--visible toast--${tone}`;

  toastTimer = window.setTimeout(() => {
    toast.className = "toast";
  }, 2400);
}

function render() {
  stopTyping();

  switch (state.screen) {
    case "intro":
      renderIntro();
      return;
    case "quiz":
      renderQuiz();
      return;
    case "fail":
      renderFail();
      return;
    case "success":
      renderSuccess();
      return;
    case "ticket":
      renderTicket();
      return;
    default:
      renderHome();
  }
}

function renderHome() {
  const hasProgress = state.gameStarted && !state.quizCompleted;
  const mainCta = hasProgress ? "Continuar missão" : state.ticketUnlocked ? "Jogar de novo" : "Começar jogo";

  app.innerHTML = `
    <main class="screen screen--home">
      <section class="layout layout--home">
        <article class="hero-card">
          <p class="eyebrow">Missão do coração</p>
          <h1 class="home-title">Convite para Date</h1>
          <p class="home-copy">
            Um mini desafio fofo, urbano e elegante. Acerte as cinco perguntas e desbloqueie o seu Date Ticket dourado.
          </p>
          <div class="actions">
            <button class="button button--primary" type="button" data-action="start-game">${mainCta}</button>
            ${
              state.ticketUnlocked
                ? '<button class="button button--secondary" type="button" data-action="view-ticket">Veja seu ticket</button>'
                : ""
            }
          </div>
        </article>

        ${(state.ticketUnlocked || hasProgress || state.lastResult) ? `
          <div class="footer-row">
            <button class="button button--ghost" type="button" data-action="reset-progress">Resetar progresso</button>
          </div>
        ` : ""}
      </section>
    </main>
  `;
}

function renderIntro() {
  const stepText = INTRO_STEPS[state.introStep] ?? INTRO_STEPS[INTRO_STEPS.length - 1];

  app.innerHTML = `
    <main class="screen screen--panel">
      <section class="layout">
        <div class="badge-row">
          <span class="badge">Introdução ${Math.min(state.introStep + 1, INTRO_STEPS.length)}/${INTRO_STEPS.length}</span>
          <span class="badge">Desbloqueio dourado</span>
        </div>

        <article class="dialogue-box">
          <div class="dialogue-head">
            <div class="dialogue-avatar">
              <img src="./dateticket_pixelart.png" alt="Ticket dourado em pixel art" class="pixel-art" />
            </div>
            <div>
              <p class="dialogue-name">Central do Ticket</p>
              <p class="dialogue-role">narradora oficial da missão</p>
            </div>
          </div>

          <p id="typewriter" class="dialogue-copy typing-cursor"></p>

          <div class="actions">
            <button class="button button--primary" type="button" data-action="continue-intro">Continuar</button>
            <button class="button button--ghost" type="button" data-action="skip-intro">Pular introdução</button>
          </div>
        </article>
      </section>
    </main>
  `;

  runTypewriter(stepText);
}

function renderQuiz() {
  if (state.currentQuestionIndex >= QUESTIONS.length) {
    state.screen = state.ticketUnlocked ? "success" : "home";
    persist();
    render();
    return;
  }

  const question = QUESTIONS[state.currentQuestionIndex];
  const orderedChoices = state.choiceOrders[question.id] || question.choices;
  const completed = state.currentQuestionIndex;
  const progress = ((state.currentQuestionIndex + 1) / QUESTIONS.length) * 100;

  app.innerHTML = `
    <main class="screen screen--quiz">
      <section class="layout">
        <article class="question-card">
          <header class="topbar">
            <div>
              <p class="progress-text">Pergunta ${state.currentQuestionIndex + 1} de ${QUESTIONS.length}</p>
              <p class="question-kicker">Só quem acerta tudo leva o ticket</p>
            </div>
            <div class="hearts" aria-label="Progresso em corações">
              ${Array.from({ length: QUESTIONS.length }, (_, index) => `
                <span class="heart ${index < completed ? "heart--filled" : ""}">${index < completed ? "❤" : "♡"}</span>
              `).join("")}
            </div>
          </header>

          <figure class="question-figure">
            <img src="${question.image}" alt="${question.prompt}" class="pixel-art" />
          </figure>

          <div class="question-body">
            <h2 class="question-title">${question.prompt}</h2>
            ${question.note ? `<p class="question-note">${question.note}</p>` : ""}

            <div class="choice-list">
              ${orderedChoices
                .map(
                  (choice, index) => `
                    <button
                      class="button button--option"
                      type="button"
                      data-action="answer"
                      data-choice="${escapeAttribute(choice)}"
                    >
                      <span class="choice-label">${choice}</span>
                    </button>
                  `,
                )
                .join("")}
            </div>

            <footer class="question-footer">
              <div class="progress-track" aria-hidden="true">
                <span class="progress-fill" style="--progress:${progress}"></span>
              </div>
            </footer>
          </div>
        </article>

        <div class="footer-row">
          <button class="button button--ghost" type="button" data-action="go-home">Voltar ao início</button>
        </div>
      </section>
    </main>
  `;
}

function renderFail() {
  app.innerHTML = `
    <main class="screen screen--panel">
      <section class="layout">
        <div class="badge-row">
          <span class="badge">Tentativa encerrada</span>
          <span class="badge">Nenhum ticket liberado</span>
        </div>

        <article class="panel">
          <p class="section-label">Quase</p>
          <h2 class="panel-title">Você vai ter que tentar de novo para desbloquear o ticket.</h2>
          <p class="panel-copy">
            O desafio foi feito para premiar cinco acertos seguidos. Na próxima rodada, vale confiar no seu lado erudito e cinematográfico.
          </p>
          <p class="panel-copy">
            A boa notícia: o recomeço é instantâneo e o prêmio continua valendo.
          </p>

          <div class="actions">
            <button class="button button--primary" type="button" data-action="retry-game">Tentar novamente</button>
            <button class="button button--secondary" type="button" data-action="go-home">Voltar ao início</button>
            ${
              state.ticketUnlocked
                ? '<button class="button button--ghost" type="button" data-action="view-ticket">Ver ticket já desbloqueado</button>'
                : ""
            }
          </div>
        </article>
      </section>
    </main>
  `;
}

function renderSuccess() {
  app.innerHTML = `
    <main class="screen screen--panel">
      <section class="layout">
        <div class="badge-row">
          <span class="badge">Parabéns</span>
          <span class="badge">Date Ticket desbloqueado</span>
        </div>

        <article class="panel">
          <p class="section-label">Prêmio raro</p>
          <h2 class="panel-title">Você desbloqueou seu Date Ticket.</h2>

          <div class="ticket-stage">
            ${renderSparkles()}
            <div class="ticket-card ticket-card--animated">
              <div class="ticket-face">
                <img src="./dateticket_pixelart.png" alt="Ticket dourado desbloqueado" class="pixel-art" />
              </div>
              <div class="ticket-face ticket-face--back">
                <div class="ticket-headline">
                  <p class="ticket-mini">validade imediata</p>
                  <p class="ticket-title--back">Date Ticket aceito</p>
                </div>
                <ul class="ticket-perks">
                  ${TICKET_PERKS.slice(0, 3).map((perk) => `<li>${perk}</li>`).join("")}
                </ul>
                <div class="ticket-stamp">status: liberado</div>
              </div>
            </div>
          </div>

          <div class="actions">
            <button class="button button--primary" type="button" data-action="view-ticket">Veja seu ticket</button>
            <button class="button button--ghost" type="button" data-action="go-home">Voltar ao início</button>
          </div>
        </article>
      </section>
    </main>
  `;
}

function renderTicket() {
  app.innerHTML = `
    <main class="screen screen--panel">
      <section class="layout">
        <div class="badge-row">
          <span class="badge">Ticket permanente</span>
          <span class="badge">toque para virar</span>
        </div>

        <article class="ticket-panel">
          <p class="section-label">Convite oficial</p>
          <h2 class="ticket-title">Seu prêmio já pode ser resgatado.</h2>
          <p class="ticket-copy">
            Este ticket foi emitido para um date aconchegante, cinematográfico e nitidamente pensado com carinho. Toque nele para ver o verso.
          </p>

          <div class="ticket-stage">
            ${renderSparkles()}
            <button class="ticket-card" type="button" data-action="flip-ticket" data-ticket aria-label="Virar ticket">
              <div class="ticket-face">
                <img src="./dateticket_pixelart.png" alt="Frente do ticket dourado" class="pixel-art" />
              </div>
              <div class="ticket-face ticket-face--back">
                <div class="ticket-headline">
                  <div class="ticket-mini">recompensa final</div>
                  <div class="ticket-title--back">Date desbloqueado</div>
                </div>
                <ul class="ticket-perks">
                  ${TICKET_PERKS.map((perk) => `<li>${perk}</li>`).join("")}
                </ul>
                <div class="ticket-stamp">resgate: sob consulta</div>
              </div>
            </button>
          </div>

          <p class="ticket-note">Os botões abaixo já deixam a mensagem pronta para compartilhar no WhatsApp.</p>

          <div class="actions">
            <button class="button button--primary" type="button" data-action="reply" data-reply-kind="yes">Sim, eu topo</button>
            <button class="button button--secondary" type="button" data-action="reply" data-reply-kind="negotiate">Quero negociar os detalhes</button>
            <button class="button button--ghost" type="button" data-action="go-home">Voltar ao início</button>
          </div>
        </article>
      </section>
    </main>
  `;
}

function renderSparkles() {
  return `
    <div class="sparkles" aria-hidden="true">
      ${Array.from({ length: 12 }, () => '<span class="sparkle"></span>').join("")}
    </div>
  `;
}

function runTypewriter(text) {
  const target = document.querySelector("#typewriter");

  if (!target) {
    return;
  }

  target.textContent = "";
  currentTyping = {
    target,
    fullText: text,
    index: 0,
    done: false,
  };

  typewriterTimer = window.setInterval(() => {
    if (!currentTyping) {
      stopTyping();
      return;
    }

    currentTyping.index += 1;
    currentTyping.target.textContent = currentTyping.fullText.slice(0, currentTyping.index);

    if (currentTyping.index >= currentTyping.fullText.length) {
      currentTyping.done = true;
      currentTyping.target.classList.remove("typing-cursor");
      stopTyping({ preserveContent: true });
    }
  }, 18);
}

function finishTyping() {
  if (!currentTyping) {
    return;
  }

  currentTyping.target.textContent = currentTyping.fullText;
  currentTyping.target.classList.remove("typing-cursor");
  currentTyping.done = true;
  stopTyping({ preserveContent: true });
}

function stopTyping({ preserveContent = false } = {}) {
  if (typewriterTimer) {
    window.clearInterval(typewriterTimer);
    typewriterTimer = null;
  }

  if (!preserveContent && currentTyping?.target) {
    currentTyping.target.classList.remove("typing-cursor");
  }

  currentTyping = null;
}

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
