// src/utils/skillsData.js
// Market-standard skills and technology stacks

export const MARKET_SKILLS = [
  // Programming Languages
  "JavaScript",
  "Python",
  "Java",
  "C++",
  "C#",
  "TypeScript",
  "Go",
  "Rust",
  "PHP",
  "Ruby",
  "Swift",
  "Kotlin",
  "R",
  "MATLAB",
  "Scala",

  // Frontend
  "React",
  "Vue.js",
  "Angular",
  "Next.js",
  "Svelte",
  "Ember.js",
  "HTML5",
  "CSS3",
  "Tailwind CSS",
  "Bootstrap",
  "Material UI",
  "Redux",
  "Vuex",

  // Backend
  "Node.js",
  "Django",
  "Flask",
  "FastAPI",
  "Spring Boot",
  "Express.js",
  "Laravel",
  "ASP.NET",
  "Ruby on Rails",
  ".NET Core",

  // Databases
  "MySQL",
  "PostgreSQL",
  "MongoDB",
  "Redis",
  "Elasticsearch",
  "Firebase",
  "DynamoDB",
  "Oracle",
  "SQL Server",
  "Cassandra",

  // DevOps & Cloud
  "AWS",
  "Azure",
  "Google Cloud",
  "Docker",
  "Kubernetes",
  "Jenkins",
  "GitLab CI/CD",
  "Terraform",
  "Ansible",

  // Mobile
  "React Native",
  "Flutter",
  "iOS",
  "Android",
  "Xamarin",

  // Data Science & ML
  "Machine Learning",
  "Deep Learning",
  "TensorFlow",
  "PyTorch",
  "Scikit-learn",
  "NLP",
  "Computer Vision",
  "Pandas",
  "NumPy",

  // Tools & Platforms
  "Git",
  "GitHub",
  "GitLab",
  "Bitbucket",
  "Jira",
  "Confluence",
  "Slack",
  "Figma",
  "Adobe XD",

  // Other Technologies
  "REST API",
  "GraphQL",
  "WebSocket",
  "Microservices",
  "Message Queues",
  "RabbitMQ",
  "Kafka",
  "Nginx",
  "Apache",
  "Linux",
  "Windows",
  "macOS",

  // Soft Skills
  "Leadership",
  "Communication",
  "Team Management",
  "Project Management",
  "Problem Solving",
  "Critical Thinking",
  "Agile",
  "Scrum",
  "Kanban",

  // Security
  "Cybersecurity",
  "OWASP",
  "SSL/TLS",
  "Authentication",
  "Authorization",
  "Data Encryption",
];

// Sort skills alphabetically for dropdown
export const SORTED_SKILLS = [...MARKET_SKILLS].sort();

// Create skill categories for better organization
export const SKILL_CATEGORIES = {
  "Programming Languages": [
    "JavaScript",
    "Python",
    "Java",
    "C++",
    "C#",
    "TypeScript",
    "Go",
    "Rust",
    "PHP",
    "Ruby",
    "Swift",
    "Kotlin",
    "R",
    "MATLAB",
    "Scala",
  ],
  Frontend: [
    "React",
    "Vue.js",
    "Angular",
    "Next.js",
    "Svelte",
    "Ember.js",
    "HTML5",
    "CSS3",
    "Tailwind CSS",
    "Bootstrap",
    "Material UI",
    "Redux",
    "Vuex",
  ],
  Backend: [
    "Node.js",
    "Django",
    "Flask",
    "FastAPI",
    "Spring Boot",
    "Express.js",
    "Laravel",
    "ASP.NET",
    "Ruby on Rails",
    ".NET Core",
  ],
  Databases: [
    "MySQL",
    "PostgreSQL",
    "MongoDB",
    "Redis",
    "Elasticsearch",
    "Firebase",
    "DynamoDB",
    "Oracle",
    "SQL Server",
    "Cassandra",
  ],
  "DevOps & Cloud": [
    "AWS",
    "Azure",
    "Google Cloud",
    "Docker",
    "Kubernetes",
    "Jenkins",
    "GitLab CI/CD",
    "Terraform",
    "Ansible",
  ],
  Mobile: ["React Native", "Flutter", "iOS", "Android", "Xamarin"],
  "Data Science & ML": [
    "Machine Learning",
    "Deep Learning",
    "TensorFlow",
    "PyTorch",
    "Scikit-learn",
    "NLP",
    "Computer Vision",
    "Pandas",
    "NumPy",
  ],
};

// Function to get suggestions based on input
export const getSkillSuggestions = (input) => {
  if (!input || input.trim().length === 0) return SORTED_SKILLS;

  const lowerInput = input.toLowerCase();
  return SORTED_SKILLS.filter((skill) =>
    skill.toLowerCase().includes(lowerInput),
  ).slice(0, 10); // Return top 10 matches
};
