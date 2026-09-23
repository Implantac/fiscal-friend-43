/**
 * Catálogo central de metadados de engenharia (blueprint).
 *
 * Cada elemento de interface documentado aponta para um `id` estável daqui.
 * Nada neste arquivo deve afirmar um contrato de provedor que não tenha sido
 * confirmado em documentação oficial da versão correspondente.
 */

export type EstadoConfianca = "validado" | "ilustrativo" | "pendente";

export interface Mapeamento {
  alvo: "Modelo interno" | "TecnoSpeed" | "PlugNotas" | "SEFAZ";
  caminho: string;
  estado: EstadoConfianca;
  nota?: string;
}

export interface Falha {
  origem: "Erro local" | "Erro do provedor" | "Rejeição fiscal";
  situacao: string;
  tratamento: string;
}

export interface DocEntry {
  id: string;
  modulo: string;
  tela: string;
  elemento: string;
  nome: string;
  finalidade: string;
  tipo: string;
  obrigatoriedade: string;
  validacaoFront: string[];
  backendPython: string[];
  mapeamentos: Mapeamento[];
  exemplo?: string;
  falhas: Falha[];
  estado: EstadoConfianca;
  rastreabilidade: {
    fonte: string;
    versao?: string;
    dataReferencia?: string;
    condicoes?: string;
  };
  pendencias?: string[];
}

const SEM_FONTE = {
  fonte: "Sem fonte oficial consultada neste protótipo",
  condicoes: "Confirmar na documentação da versão utilizada antes de implementar.",
};

export const catalog: DocEntry[] = [
  /* ---------------- Global ---------------- */
  {
    id: "global.ambiente",
    modulo: "Global",
    tela: "Todas",
    elemento: "Selo de ambiente",
    nome: "Ambiente de execução",
    finalidade:
      "Deixar explícito que nenhuma operação desta aplicação gera documento fiscal real.",
    tipo: "Enum de ambiente (simulação | homologação | produção)",
    obrigatoriedade: "Sempre visível",
    validacaoFront: [
      "O protótipo opera travado em 'Simulação'.",
      "Qualquer ambiente diferente de simulação deve exigir configuração segura no back-end.",
    ],
    backendPython: [
      "Ambiente, certificado e credenciais ficam exclusivamente no back-end.",
      "O front-end nunca recebe certificado, token ou senha.",
    ],
    mapeamentos: [
      {
        alvo: "Modelo interno",
        caminho: "simulacao.ambiente",
        estado: "ilustrativo",
      },
      {
        alvo: "TecnoSpeed",
        caminho: "Parâmetro de ambiente do componente",
        estado: "pendente",
        nota: "Nome e domínio do parâmetro dependem do componente e da versão adotada.",
      },
    ],
    falhas: [
      {
        origem: "Erro local",
        situacao: "Ambiente configurado incorretamente na integração real.",
        tratamento:
          "Bloquear a ação e exigir confirmação explícita antes de qualquer transmissão.",
      },
    ],
    estado: "ilustrativo",
    rastreabilidade: SEM_FONTE,
  },
  {
    id: "global.modo-desenvolvedor",
    modulo: "Global",
    tela: "Todas",
    elemento: "Alternância Modo Desenvolvedor",
    nome: "Modo Desenvolvedor",
    finalidade:
      "Expor o blueprint técnico sobre a mesma interface operacional, sem recarregar a página.",
    tipo: "Booleano em estado global",
    obrigatoriedade: "Opcional para o operador",
    validacaoFront: [
      "Alternância em tempo de execução.",
      "Não pode bloquear o funcionamento normal dos controles.",
    ],
    backendPython: ["Nenhuma responsabilidade — recurso exclusivo de front-end."],
    mapeamentos: [
      { alvo: "Modelo interno", caminho: "ui.devMode", estado: "ilustrativo" },
    ],
    falhas: [],
    estado: "ilustrativo",
    rastreabilidade: {
      fonte: "Requisito do prompt mestre do projeto",
      dataReferencia: "2026",
    },
  },

  /* ---------------- Módulo 1 ---------------- */
  {
    id: "m1.tabela",
    modulo: "Módulo 1 — Manifestação",
    tela: "Central de Manifestação de Notas",
    elemento: "Tabela de notas recebidas",
    nome: "Documentos destinados ao CNPJ da empresa",
    finalidade:
      "Listar notas emitidas contra a empresa para que o operador manifeste posição sobre cada operação.",
    tipo: "Coleção de documentos recebidos",
    obrigatoriedade: "Origem: consulta ao provedor, não digitação",
    validacaoFront: [
      "Nenhuma. A lista é apenas apresentação de dados retornados pelo back-end.",
      "Filtros e ordenação são locais e não alteram o documento.",
    ],
    backendPython: [
      "Executar a consulta de documentos destinados e persistir o resultado.",
      "Controlar paginação/NSU ou equivalente conforme o mecanismo do provedor utilizado.",
      "Normalizar o retorno para o modelo interno antes de entregar ao front-end.",
    ],
    mapeamentos: [
      { alvo: "Modelo interno", caminho: "notaRecebida[]", estado: "ilustrativo" },
      {
        alvo: "TecnoSpeed",
        caminho: "Serviço de distribuição/consulta de documentos destinados",
        estado: "pendente",
        nota: "Endpoint, parâmetros e formato de retorno precisam ser confirmados na documentação da versão contratada.",
      },
    ],
    exemplo: `// Exemplo ilustrativo do modelo interno (não é contrato de provedor)
{
  "chave": "35250400011122000199550010000001231000001230",
  "emitente": "Metalúrgica Boa Vista Ltda",
  "cnpj": "00011122000199",
  "emissao": "2026-09-14",
  "valor": 12480.50,
  "status": "sem_manifestacao",
  "xmlDisponivel": false
}`,
    falhas: [
      {
        origem: "Erro do provedor",
        situacao: "Serviço de consulta indisponível ou limite de requisições atingido.",
        tratamento:
          "Manter a lista anterior, sinalizar desatualização e permitir nova tentativa manual.",
      },
    ],
    estado: "ilustrativo",
    rastreabilidade: SEM_FONTE,
    pendencias: [
      "Definir se a lista virá de consulta ao provedor, de base própria ou de ambos.",
      "Confirmar a periodicidade permitida de consulta pelo provedor.",
    ],
  },
  {
    id: "m1.chave",
    modulo: "Módulo 1 — Manifestação",
    tela: "Central de Manifestação de Notas",
    elemento: "Chave de acesso + botão copiar",
    nome: "Chave de acesso do documento",
    finalidade: "Identificar univocamente o documento fiscal eletrônico.",
    tipo: "String numérica de 44 posições",
    obrigatoriedade: "Obrigatória para qualquer evento sobre o documento",
    validacaoFront: [
      "Conferir comprimento de 44 dígitos numéricos.",
      "Conferir o dígito verificador antes de enviar (evita ida desnecessária ao provedor).",
    ],
    backendPython: [
      "Revalidar a chave no servidor — validação de front-end não é autoritativa.",
      "Usar a chave como identificador de correlação entre documento, eventos e XML.",
    ],
    mapeamentos: [
      { alvo: "Modelo interno", caminho: "notaRecebida.chave", estado: "ilustrativo" },
      {
        alvo: "TecnoSpeed",
        caminho: "Campo de chave no serviço de eventos",
        estado: "pendente",
        nota: "Nome exato da propriedade deve ser confirmado na documentação da versão.",
      },
    ],
    falhas: [
      {
        origem: "Erro local",
        situacao: "Chave com tamanho ou dígito verificador inválido.",
        tratamento: "Bloquear a ação e destacar o documento com problema.",
      },
    ],
    estado: "ilustrativo",
    rastreabilidade: {
      fonte:
        "Estrutura de 44 posições e dígito verificador constam do Manual de Orientação do Contribuinte da NF-e — versão e data ainda não registradas neste protótipo",
      condicoes: "Registrar a versão do MOC consultada antes de tratar como validado.",
    },
  },
  {
    id: "m1.manifestar",
    modulo: "Módulo 1 — Manifestação",
    tela: "Central de Manifestação de Notas",
    elemento: "Menu de manifestação",
    nome: "Evento de manifestação do destinatário",
    finalidade:
      "Registrar a posição do destinatário sobre a operação: ciência, confirmação, não realizada ou desconhecimento.",
    tipo: "Evento com tipo, chave, data e, em alguns tipos, justificativa",
    obrigatoriedade:
      "Condicional — a obrigatoriedade depende do tipo de operação, do porte e das regras aplicáveis. Não tratar como obrigatório para todos os casos.",
    validacaoFront: [
      "Exigir justificativa nos tipos que a requerem, conforme regra configurada no back-end.",
      "Impedir reenvio do mesmo evento já registrado sem aviso ao operador.",
      "Confirmar ações irreversíveis antes de enviar.",
    ],
    backendPython: [
      "Montar o evento, assinar com o certificado e transmitir através do componente contratado.",
      "Persistir protocolo, data/hora e retorno bruto para auditoria.",
      "Aplicar as regras de sequência e de repetição de evento conforme a documentação vigente.",
    ],
    mapeamentos: [
      {
        alvo: "Modelo interno",
        caminho: "eventoManifestacao{ chave, tipo, justificativa? }",
        estado: "ilustrativo",
      },
      {
        alvo: "TecnoSpeed",
        caminho: "Serviço de envio de evento de manifestação",
        estado: "pendente",
        nota: "Códigos de evento e nomes de campos devem vir do manual da versão utilizada.",
      },
    ],
    exemplo: `// Exemplo ilustrativo — não use como contrato de integração
{
  "chave": "35250400011122000199550010000001231000001230",
  "tipo": "confirmacao",
  "justificativa": null
}`,
    falhas: [
      {
        origem: "Erro local",
        situacao: "Justificativa ausente ou menor que o mínimo exigido.",
        tratamento: "Mensagem junto ao campo e foco no campo com problema.",
      },
      {
        origem: "Erro do provedor",
        situacao: "Falha de comunicação, certificado vencido ou serviço fora do ar.",
        tratamento:
          "Permitir nova tentativa sem duplicar o evento; registrar a mensagem técnica.",
      },
      {
        origem: "Rejeição fiscal",
        situacao: "Evento recusado pela SEFAZ, inclusive por duplicidade.",
        tratamento:
          "Exibir o código e a descrição retornados pela própria SEFAZ, sem reescrever o texto oficial.",
      },
    ],
    estado: "ilustrativo",
    rastreabilidade: SEM_FONTE,
    pendencias: [
      "Códigos oficiais de evento e de rejeição (inclusive duplicidade) precisam ser extraídos do manual vigente — não foram fixados no protótipo.",
      "Definir se o sistema deve permitir substituição de uma manifestação anterior e sob quais condições.",
    ],
  },
  {
    id: "m1.xml",
    modulo: "Módulo 1 — Manifestação",
    tela: "Central de Manifestação de Notas",
    elemento: "Ação de download de XML",
    nome: "Obtenção do XML do documento",
    finalidade: "Disponibilizar o arquivo do documento para escrituração e arquivamento.",
    tipo: "Arquivo XML associado à chave",
    obrigatoriedade: "Disponibilidade variável conforme o cenário",
    validacaoFront: [
      "Só habilitar quando o back-end indicar que o arquivo existe na base.",
      "Nunca montar um XML no front-end.",
    ],
    backendPython: [
      "Obter o documento pelo mecanismo de distribuição do provedor e armazená-lo.",
      "Servir o arquivo a partir do armazenamento próprio, com controle de acesso.",
    ],
    mapeamentos: [
      { alvo: "Modelo interno", caminho: "notaRecebida.xmlDisponivel", estado: "ilustrativo" },
      {
        alvo: "TecnoSpeed",
        caminho: "Serviço de download de documento",
        estado: "pendente",
      },
    ],
    falhas: [
      {
        origem: "Erro do provedor",
        situacao: "Documento ainda não disponível na distribuição.",
        tratamento:
          "Informar indisponibilidade no cenário atual, sem afirmar que a manifestação sempre libera o arquivo.",
      },
    ],
    estado: "ilustrativo",
    rastreabilidade: SEM_FONTE,
    pendencias: [
      "A relação entre manifestação e liberação do XML varia por situação; não generalizar uma regra única.",
    ],
  },
  {
    id: "m1.danfe",
    modulo: "Módulo 1 — Manifestação",
    tela: "Central de Manifestação de Notas",
    elemento: "Visualização do DANFE",
    nome: "DANFE demonstrativo",
    finalidade: "Permitir conferência visual do documento pelo operador.",
    tipo: "Representação gráfica gerada a partir do documento",
    obrigatoriedade: "Opcional",
    validacaoFront: ["Somente exibição; não altera dados do documento."],
    backendPython: [
      "Gerar ou obter a representação gráfica a partir do XML autorizado.",
      "Não reconstruir o documento a partir de dados digitados.",
    ],
    mapeamentos: [
      { alvo: "Modelo interno", caminho: "notaRecebida.itensDemo[]", estado: "ilustrativo" },
    ],
    falhas: [
      {
        origem: "Erro do provedor",
        situacao: "Representação indisponível por ausência do XML.",
        tratamento: "Informar a ausência e oferecer nova tentativa.",
      },
    ],
    estado: "ilustrativo",
    rastreabilidade: SEM_FONTE,
  },
];

export const catalogById = new Map(catalog.map((e) => [e.id, e]));

export const estadoLabel: Record<EstadoConfianca, string> = {
  validado: "Validado",
  ilustrativo: "Ilustrativo",
  pendente: "Pendente de validação",
};
